# Modelos Binomial y Bayes — Funcionamiento en el código

Documento generado a partir del estado actual del repositorio. Describe cómo están implementados los dos modos del DSL de riesgos y aporta feedback al final.

Convenciones globales:

- Las probabilidades en nodos/aristas se almacenan en escala **0–100** (`MAX_PROBABILITY = 100`, `PROBABILITY_KEY = 'probability'`, ver [src/daga/utils/probability.utils.ts](src/daga/utils/probability.utils.ts) y [CLAUDE.md](CLAUDE.md)).
- `DagaBaseComponent` ([src/daga/component/dagaBase.component.ts](src/daga/component/dagaBase.component.ts)) es el motor común sobre el canvas `@metadev/daga`. Cada modo lo configura vía `@Input()`.
- Los IDs de nodo se normalizan con `normalizeNodeId` (quita el sufijo `_port_<n>` que añade daga).

---

## 1. Modelo Binomial

### 1.1 Configuración del modo

[binomial.component.ts:18-22](src/daga/component/binomial.component.ts#L18-L22)

```ts
branchValueKey = 'weight';
showTheoreticalProbabilities = true;
```

Esto activa dos comportamientos del `DagaBaseComponent`:

- Las aristas dejan de representar probabilidades y pasan a representar **pesos** (`weight`). Como `branchValueKey !== probabilityKey`, en [dagaBase.component.ts:370-388](src/daga/component/dagaBase.component.ts#L370-L388) `refreshConnectionWeightLabels` escribe el peso bruto como `endLabel` de la conexión.
- Se renderiza un segundo decorador rojo encima del nodo con la **probabilidad teórica acumulada** (`drawTheoreticalProbabilityDecorator`).

Como `branchValueKey === 'weight'`, en [dagaBase.component.ts:233-251](src/daga/component/dagaBase.component.ts#L233-L251) las ediciones de conexiones siguen la rama de "peso bruto": se normalizan con `normalizeWeightValue` y se escriben en `valueSet`, sin disparar el rebalanceo entre hermanos (`handleConnectionUpdateValues`). El switch `autoNormalizeAdjacent` queda inerte en este modo (línea 76: `&& this.branchValueKey === this.probabilityKey`).

### 1.2 Probabilidad por nodo

Cada nodo guarda su probabilidad de éxito local (`probability`, 0–100). Casos especiales:

- `state-diagram-node` → probabilidad forzada a `maxProbability` (100). Visible en [binomialWeight.utils.ts:167-183](src/daga/utils/binomialWeight.utils.ts#L167-L183) y en [binomialCalculationNodes.utils.ts:297-300](src/daga/utils/binomialCalculationNodes.utils.ts#L297-L300).
- Nodos `transition` → idem (probabilidad = 1 en la simulación).
- Nodos con `data.end === true`, nombre `"end"` o tipo `end` → terminales de éxito. Conjunto construido con `buildEndNodeIdSet`.

### 1.3 Simulación Monte Carlo

`calculateBinomialProbability(model, iterations, probabilityKey, maxProbability, startNodeId?)` en [binomialCalculationNodes.utils.ts:205-254](src/daga/utils/binomialCalculationNodes.utils.ts#L205-L254).

Bucle: por cada iteración llama a `simulateIteration` y cuenta éxitos. Una iteración:

1. Parte del `startNode` (el indicado por el usuario o el detectado por `findStartNode`).
2. `getFirstProbabilityNode` salta el nodo Start si no tiene probabilidad propia.
3. Mientras haya nodo actual:
   - Si es un end-node → éxito.
   - Si `hasEndNode` y el nodo no tiene salidas → fracaso.
   - Si no hay end-node global y se llegó aquí por elección ponderada → éxito si `data.important !== false`.
   - Tirada `Math.random() < probability` (probabilidad normalizada a 0–1).
     - Si falla → fracaso de la iteración.
     - Si pasa → elegir siguiente nodo con `getNextNode` ([líneas 88-136](src/daga/utils/binomialCalculationNodes.utils.ts#L88-L136)): selección **ponderada por pesos** de las aristas salientes (ruleta sobre `totalWeight`).
4. Hay un `maxSteps = nodes + 1` como salvaguarda anti-bucles.

Resultado: `{ startNodeId, startNodeName, iterations, successIterations }`.

### 1.4 Probabilidad teórica

`calculateTheoreticalNodeProbabilities` en [binomialWeight.utils.ts:252-299](src/daga/utils/binomialWeight.utils.ts#L252-L299) hace un DFS desde cada start node propagando:

```
P(nodo_hijo) += P(nodo_padre) · (peso_arista / Σ pesos_aristas_salientes) · (prob_local_hijo / max)
```

El recorrido usa `visited` por rama (se añade al entrar y se quita al salir), de forma que ramas hermanas que comparten un descendiente acumulan probabilidades en `results`.

En [binomial.component.ts:81-91](src/daga/component/binomial.component.ts#L81-L91) la probabilidad teórica global se obtiene sumando las contribuciones de todos los end-nodes y se muestra junto al resultado simulado.

### 1.5 Resumen de flujo

```
Edit arista (weight) → DagaBase.handleUpdateValuesAction → normalizeWeightValue → valueSet
Edit nodo (probability) → normalizeProbability → valueSet
Refresh decoradores: probabilidad local (negro, debajo) + probabilidad teórica (rojo, encima)
"Calcular": calculateBinomialProbability (Monte Carlo) + calculateTheoreticalNodeProbabilities (analítico)
```

---

## 2. Modelo Bayes

### 2.1 Estructura interna

Se mantiene un grafo paralelo al modelo daga, `BayesGraph = Map<id, BayesNodeInfo>`, construido por `buildBayesGraph` ([bayesInference.utils.ts:110-182](src/daga/utils/bayes/bayesInference.utils.ts#L110-L182)). Cada nodo tiene:

```ts
{ id, name, parents[], children[], evidence: 'si'|'no'|null,
  cpt: BayesCPT, marginals: { si, no } }
```

Las CPTs y la evidencia se persisten en `node.valueSet` con cuatro claves ([bayesInference.utils.ts:9-12](src/daga/utils/bayes/bayesInference.utils.ts#L9-L12)):

- `bayes_cpt` — JSON con la tabla.
- `bayes_evidence` — `'si' | 'no' | 'null'`.
- `bayes_pSi`, `bayes_pNo` — marginales actuales (las usa el decorador para pintar barras).

Variables binarias hardcodeadas: `STATES = ['si', 'no']`.

### 2.2 Construcción de la CPT

`generateDefaultCPT(parents)`:

- Nodo raíz → `{ prior: { si: 0.5, no: 0.5 } }`.
- Nodo con N padres → `getParentCombinations` produce 2^N combinaciones; cada clave tiene la forma `padre1_si|padre2_no|...` y valor uniforme `{ si: 0.5, no: 0.5 }`.

`recalcCPTOnParentChange(oldCPT, newParents)` migra preservando filas cuya clave siga existiendo y rellenando las nuevas a 0.5/0.5.

`validateCPT` marca como inválida cualquier fila cuya suma `si+no` se aleje más de 0.01 de 1.

### 2.3 Inferencia exacta

`recalcAllMarginals(graph)` en [bayesInference.utils.ts:240-280](src/daga/utils/bayes/bayesInference.utils.ts#L240-L280):

1. `topologicalSort` (Kahn). Si el sort devuelve menos nodos → hay ciclo → marginales 0.5/0.5 y se aborta.
2. `enumerateWorlds` enumera **todos los mundos** consistentes con la evidencia recorriendo el orden topológico. Para cada nodo prueba `si` y `no`, descarta lo que choca con la evidencia, y multiplica el peso por `P(estado | padres)` según la CPT.
3. `totalWeight = Σ pesos`. Para cada nodo:
   - Si tiene evidencia → marginal `1/0` o `0/1`.
   - Si no → `P(nodo=si) = Σ pesos_mundos_con_nodo_si / totalWeight`.

Complejidad: O(2^N · N). Hay un warning en consola si `graph.size > 20`; la UI muestra banner pero no aborta. La componente expone `isNetworkTooLarge = size > 20`.

### 2.4 Monte Carlo (forward sampling)

[montecarlo.utils.ts](src/daga/utils/bayes/montecarlo.utils.ts) — `ejecutarMonteCarlo`:

- Para cada iteración, `muestrearRed` recorre los nodos en orden topológico; si hay evidencia la fija, si no, samplea de la fila CPT correspondiente a los valores ya muestreados de los padres.
- Cuenta frecuencias y devuelve frecuencias relativas como aproximación.
- `calcularError` compara contra `marginalesExactos` para mostrar error empírico.

**Importante**: como filtra después en lugar de antes, el muestreo de la red con evidencias mezcla *forward sampling* puro con asignación dura: si en `muestrearRed` un nodo tiene evidencia, simplemente se asigna sin reponderar el muestreo. Esto significa que las muestras **no son** estimadores insesgados de `P(X | evidencia)` cuando hay evidencia río abajo — son `P(X)` con evidencia hardcodeada en algunos nodos. Ver feedback §4.

### 2.5 Aprendizaje desde CSV

Dos rutas en `BayesComponent.confirmarAprendizaje`:

- **MLE** ([mle.utils.ts](src/daga/utils/bayes/mle.utils.ts)) — si el CSV cubre todas las variables. Cuenta ocurrencias con suavizado de Laplace (`+1` por defecto), normaliza por fila de CPT.
- **EM** ([em.utils.ts](src/daga/utils/bayes/em.utils.ts)) — si hay variables ocultas. Bucle E-step (inferir marginales por fila con la evidencia parcial) / M-step (reestimar CPTs ponderadas por las posteriors), con `tolerancia=0.001` y `maxIter=50`. Hace `await setTimeout(0)` cada iteración para no bloquear UI.

Importación CSV: `parsearCSV` admite comentarios `#` y una línea `# edges: Padre->Hijo; ...` para autoinstanciar nodos+aristas desde el CSV (`autoCreateNodesAndRelations`), aplicando `BayesCausalLayout` al final.

### 2.6 Interacción UI

- El `DagaBaseComponent` está en modo `bayesMode=true` ([bayes.component.ts:33-38](src/daga/component/bayes.component.ts#L33-L38)). En este modo `handleUpdateValuesAction` es no-op ([dagaBase.component.ts:211-214](src/daga/component/dagaBase.component.ts#L211-L214)) — los nodos no procesan ediciones de `probability`.
- Doble-click sobre un nodo: listener nativo sobre `daga-diagram` que sube por DOM hasta `data-node-id`, normaliza y emite `nodeDoubleClicked` ([dagaBase.component.ts:128-160](src/daga/component/dagaBase.component.ts#L128-L160)).
- El popup permite (a) fijar evidencia `si`/`no`/`null`, (b) editar celdas de la CPT, y opcionalmente autocompletar la celda complementaria si `autoNormalizeCPT` está activo.
- Cada edición → `recalcAllMarginals` → `syncMarginalsToModel` (escribe `bayes_pSi/pNo` en el `valueSet`) → `refreshProbabilityDecorators` → se redibujan barras + badge dentro del nodo ([dagaBase.component.ts:473-536](src/daga/component/dagaBase.component.ts#L473-L536)).
- Cambios estructurales (añadir/quitar nodo o arista): `onModelChange` reconstruye `bayesGraph` preservando evidencia y migrando CPTs cuando los padres cambian.

### 2.7 Resumen de flujo

```
Edit modelo en canvas → onModelChange → buildBayesGraph + restaurar evidencia/CPT + recalcCPTOnParentChange
                      → recalcAllMarginals (inferencia exacta) → syncMarginalsToModel → redibujar decoradores
Doble-click nodo → popup → setEvidence / updateCPTCell → recalcAllMarginals → idem
"Monte Carlo" → ejecutarMonteCarlo (forward sampling) → comparar con marginalesExactos
"Aprender desde CSV" → parsearCSV → analizarCSV → MLE o EM → aceptar reemplaza bayesGraph
```

---

## 3. Feedback / cosas que cambiaría

### Binomial

1. **Mezcla de Monte Carlo + cálculo analítico** ([binomial.component.ts:73-91](src/daga/component/binomial.component.ts#L73-L91)) — ya tienes `calculateTheoreticalNodeProbabilities` exacto. Si quieres mantener la simulación como demostración pedagógica, vale; si lo quieres como motor de cálculo, el Monte Carlo sobra: el algoritmo analítico es exacto, determinista y mucho más barato. Plantéate mostrar las dos métricas con una etiqueta clara ("teórica" vs. "empírica con N iteraciones") en vez de calcular ambas siempre.

2. **`isTerminalSuccessNode` depende de `data.important !== false`** ([binomialCalculationNodes.utils.ts:156-158](src/daga/utils/binomialCalculationNodes.utils.ts#L156-L158)) — convención frágil y no documentada en el DSL. O bien la conviertes en un tipo de nodo explícito (`success-node` / `failure-node`), o bien la pones en CLAUDE.md como contrato de datos.

3. **`maxSteps = nodes + 1`** ([línea 275](src/daga/utils/binomialCalculationNodes.utils.ts#L275)) corta cualquier camino que reentre en un nodo. Está bien como cinturón anti-ciclos, pero no avisa al usuario. Si el DSL no admite ciclos, valídalo antes de simular (validator); si los admite, este corte sesga los resultados sin que el usuario lo sepa.

4. **`normalizeWeight` duplicado** en [binomialCalculationNodes.utils.ts:14-43](src/daga/utils/binomialCalculationNodes.utils.ts#L14-L43) vs `normalizeWeightValue` en [binomialWeight.utils.ts:49-66](src/daga/utils/binomialWeight.utils.ts#L49-L66) — son casi idénticos. Unifica.

5. **`getConnectionDataProbability` lee `'probability' ?? 'weight' ?? 'chance'`** — tres alias para el mismo valor sugieren que en algún momento se mezclaron escalas. Mejor: una sola clave canónica y migración explícita al cargar modelos viejos.

### Bayes

6. **Variables binarias hardcodeadas** (`STATES = ['si','no']`). Para una DSL de riesgos quizá basta, pero te bloquea casos de uso obvios (severidad baja/media/alta, semaforización). Generalizar la CPT a `Record<state, number>` con un array de estados por nodo es un cambio acotado.

7. **`recalcAllMarginals` es O(2^N)** y la única salvaguarda es un `console.warn` a partir de 20 nodos. Con 25-30 nodos el navegador se cuelga. Opciones, de menos a más invasivo:
   - Banner de UI bloqueante si `size > 20` (ya tienes `isNetworkTooLarge`, úsalo para evitar la llamada en lugar de solo avisar).
   - Variable Elimination con un orden razonable → O(N · 2^treewidth). Es la mejora con mejor ratio coste/beneficio.
   - Belief Propagation aproximada para redes grandes.

8. **Monte Carlo con evidencia río abajo no es correcto** (§2.4). El forward sampling con evidencias asignadas produce muestras que **no** son de `P(X | E)`. Para una herramienta didáctica/de validación esto importa porque `calcularError` compara MC contra la inferencia exacta y la diferencia será sistemática, no estadística, en redes con evidencia en hojas. Soluciones:
   - **Likelihood weighting** (mínimo cambio): no fuerces el nodo evidencia; samplea normalmente y pondera la muestra por `P(evidencia | padres)`.
   - **Rejection sampling**: samplea libre, descarta muestras inconsistentes con la evidencia. Simple pero ineficiente.
   - **Gibbs sampling** si quieres soportar evidencia abundante.

9. **Persistencia de CPTs como JSON en `valueSet`** ([bayes.component.ts:355-358](src/daga/component/bayes.component.ts#L355-L358)). Funciona, pero acoplas el modelo del canvas a una serialización ad-hoc. Si vas a exportar/importar (ya tienes `importExport.utils`), define el esquema bayesiano en el RiskFile en vez de embeberlo como string dentro de un value set genérico.

10. **`onModelChange` reconstruye el grafo entero en cada edición** y compara JSON serializado para detectar cambios estructurales. En redes medianas no notas, pero el O(2^N) de `recalcAllMarginals` se dispara cada keystroke en una CPT. Considera (a) recalcular sólo el subgrafo afectado, o (b) debouncear el recálculo.

11. **`autoCreateNodesAndRelations`** ([bayes.component.ts:555-613](src/daga/component/bayes.component.ts#L555-L613)) parsea aristas del CSV vía comentarios. Es ingenioso pero queda fuera de cualquier estándar; un CSV "normal" sólo crea nodos sueltos. Documenta el formato `# edges: A->B` en un README/CLAUDE.md o muévelo a un campo de metadatos.

12. **Doble-click resuelto vía `document.querySelector('daga-diagram')` + `data-node-id`** ([dagaBase.component.ts:128-160](src/daga/component/dagaBase.component.ts#L128-L160)) — frágil ante cambios en `@metadev/daga`. Si la librería expone un evento de selección, mejor suscribirse a él; si no, encapsular este hack en una sola función con un comentario explicando *por qué* es así.

### Transversal

13. **CLAUDE.md y este código discrepan en la persistencia bayesiana**: CLAUDE menciona `evidence` y `si/no` pero no las cuatro claves (`bayes_cpt`, `bayes_evidence`, `bayes_pSi`, `bayes_pNo`). Conviene reflejarlas para futuros mantenedores.

14. **Lógica de `state-diagram-node = probabilidad 100`** repetida en al menos 3 sitios ([dagaBase.component.ts:306-313](src/daga/component/dagaBase.component.ts#L306-L313), [binomialWeight.utils.ts:167-179](src/daga/utils/binomialWeight.utils.ts#L167-L179), [binomialCalculationNodes.utils.ts:160-170](src/daga/utils/binomialCalculationNodes.utils.ts#L160-L170)). Extrae a un helper `getEffectiveNodeProbability(node, maxProb)`.

15. **Tests**: hay specs en `utils/` pero no veo tests específicos para `recalcAllMarginals` con evidencia ni para `calculateTheoreticalNodeProbabilities` con grafos diamante (donde la lógica de `visited` por rama es delicada). Son los dos sitios donde un bug daría números plausibles pero incorrectos — vale la pena fijarlos.
