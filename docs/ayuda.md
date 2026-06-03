# Guía de ayuda de Risk

## ¿Qué es Risk?

Risk es una aplicación web para el **modelado visual y el cálculo probabilístico del riesgo**, pensada para apoyar la toma de decisiones en entornos críticos como misiones espaciales, banca y seguros.

Se apoya en un modelo de dominio que sirve de base para un **DSL visual** (un lenguaje específico de dominio), integrado con una potente librería de diagramación web ([Daga](https://daga.metadev.pro)). Sobre esa base se ha construido una arquitectura de frontend con Angular y TypeScript que gestiona la interacción, el modelado visual, la importación/exportación y los cálculos probabilísticos directamente en el navegador.

Su objetivo es hacer accesibles los modelos de riesgo complejos a cualquier usuario, sin importar su perfil técnico. Al tender un puente entre los datos estadísticos en bruto y los diagramas visuales, Risk permite a analistas y responsables entender relaciones probabilísticas complicadas, explorar escenarios de incertidumbre y tomar decisiones más rápidas, seguras e informadas.

## Casos de uso

Risk se utiliza principalmente para:

- Modelado visual de riesgo en cadenas de eventos.
- Cálculo de probabilidades en procesos secuenciales (control de calidad, cadenas de suministro, ciberseguridad, ensayos clínicos…).
- Análisis de redes causales con evidencia parcial mediante redes bayesianas.
- Estimación de riesgo en sistemas con incertidumbre (misiones espaciales, aborto de lanzamiento, recuperación de cápsulas…).
- Aprendizaje de probabilidades a partir de datos reales (CSV).

## Cómo usarla

1. **Aprende cambiando los ejemplos.** La página de inicio incluye ejemplos listos para abrir en cada modo. Es la forma más rápida de entender la notación.
2. **Elige un modo** en la barra lateral: **Binomial** o **Bayes** (ver más abajo).
3. **Construye tu diagrama** arrastrando nodos al lienzo y conectándolos. El cálculo se actualiza al vuelo.
4. **Edita los valores** (pesos o tablas de probabilidad) directamente sobre cada elemento.
5. **Importa / Exporta** tu modelo como archivo `.json` (`RiskFile`) para guardarlo o compartirlo.
6. **Calcula** los resultados y revísalos en el panel lateral de resultados.

---

## Funciones del modo Binomial

| Botón                     | Para qué sirve                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Import**                | Carga un modelo guardado (`RiskFile` `.json`).                                         |
| **Export**                | Descarga el modelo actual como `.json`.                                                |
| **Calculate Probability** | Abre el diálogo de cálculo: elige nodo inicial e iteraciones, y ejecuta la simulación. |
| **View Results**          | Muestra el panel lateral con el historial de simulaciones.                             |

**Diálogo de cálculo.** Indica el número de **iteraciones** y, si hay varios nodos de inicio, selecciona el **nodo de inicio**. La aplicación simula el recorrido por el diagrama y devuelve:

- **Success Rate** — proporción de iteraciones que llegaron al éxito.
- **Theoretical** — probabilidad teórica calculada de forma exacta a partir de los pesos del diagrama, para contrastar con la simulación.

**Notación gráfica (Binomial).** Cuatro tipos de nodo:

- **Node Start** — punto de entrada del proceso.
- **Node State** — estado intermedio.
- **Node Event** — evento que ocurre con cierta probabilidad.
- **Node End** — resultado final.

Las conexiones llevan **pesos** que determinan la probabilidad de tomar cada rama. Los pesos de ramas hermanas pueden re-balancearse automáticamente.

---

## Funciones del modo Bayes

| Botón            | Para qué sirve                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Import**       | Carga un modelo guardado (`RiskFile` `.json`).                                                 |
| **Export**       | Descarga el modelo actual, incluyendo las CPTs y la evidencia.                                 |
| **Import CSV**   | Aprende las probabilidades de la red a partir de un CSV de datos (MLE o EM).                   |
| **Generate CSV** | Genera datos sintéticos a partir de la red actual (útil para pruebas).                         |
| **Monte Carlo**  | Inferencia aproximada para redes grandes; compara con la inferencia exacta y muestra el error. |
| **View Results** | Historial de simulaciones Monte Carlo.                                                         |

**Editar un nodo (doble clic).** Al hacer doble clic sobre un nodo se abre su ventana:

- **Evidence** — fija el estado observado del nodo: **Yes**, **No** o **?** (sin evidencia). Al introducir evidencia, la red recalcula todas las marginales.
- **Probabilities** — muestra `P(=Yes)` y `P(=No)` actuales del nodo.
- **CPT Table** — tabla de probabilidad condicionada. En nodos raíz define la probabilidad inicial; en nodos con padres, define cómo cambia la probabilidad según el estado de los padres. La casilla **Auto-Normalize** ajusta cada fila para que sume 1.

**Aprender desde CSV.** Sube un CSV cuyas columnas coincidan con los nombres de los nodos. Valores aceptados: `yes/no`, `si/no`, `1/0`, `true/false`. Las celdas vacías marcan la variable como oculta en esa fila → se usa **EM** en lugar de **MLE**. Para crear conexiones automáticamente al importar nodos nuevos, añade una primera línea con el formato:

```
# edges: Burglary->Alarm; Earthquake->Alarm; Alarm->John; Alarm->Mary
```

Sin esa línea solo se crean los nodos, y las relaciones se cablean a mano.

**Monte Carlo.** La inferencia exacta está limitada a 20 nodos (coste O(2^N)). Para redes más grandes usa Monte Carlo (ponderación por verosimilitud): indica las iteraciones, ejecuta, y la tabla muestra `P(Yes)` aproximada frente a la exacta y el error.

**Notación gráfica (Bayes).** Tres tipos de nodo:

- **Node Cause** — causa raíz.
- **Node Effect** — efecto que depende de sus padres.
- **Node Event** — evento intermedio.

Cada nodo muestra inline sus marginales (`si`/`no`) y la evidencia introducida.

---

## Introducción a los dos modos

### Modo Binomial

**Para qué sirve.** Modela procesos **secuenciales** en los que ocurren eventos en cadena, cada uno con una probabilidad de éxito o fallo independiente. Responde a preguntas como _"¿cuál es la probabilidad de que un pedido llegue al cliente si cada eslabón puede fallar?"_ o _"¿cuál es la probabilidad de que un fármaco supere todas las fases del ensayo clínico?"_.

**Cómo está creado.** El diagrama es un grafo de nodos (inicio, estado, evento, fin) unidos por conexiones con **pesos**. Cada peso representa la probabilidad de tomar esa rama. La probabilidad teórica de llegar a un resultado se calcula multiplicando las probabilidades a lo largo del camino (`calculateTheoreticalNodeProbabilities`). Además, un motor de **simulación** recorre el grafo muchas veces (las _iteraciones_) y mide cuántas veces se alcanza el éxito, lo que permite contrastar el valor teórico con uno empírico.

**Por qué se ha usado.** El enfoque binomial encaja de forma natural con riesgos que se descomponen en pasos sucesivos de tipo éxito/fallo. Es intuitivo —se lee el diagrama de izquierda a derecha—, fácil de parametrizar con datos históricos (porcentajes de fallo por etapa) y suficiente para una enorme variedad de casos reales: control de calidad, cadenas logísticas, cadenas de ataque en ciberseguridad o el embudo de fases de un ensayo clínico. La simulación añade además una validación empírica de los cálculos.

### Modo Bayes

**Para qué sirve.** Modela **redes causales** en las que varias variables se influyen entre sí, y permite razonar con **evidencia parcial**: al observar el estado de algunos nodos, la red actualiza la probabilidad del resto. Responde a preguntas como _"si se detecta un fallo de motor durante el vuelo, ¿cuál es la probabilidad de alcanzar órbita?"_ o _"si saltó la alarma de aborto, ¿cuál es la probabilidad de que el fallo sea real?"_.

**Cómo está creado.** Es una **red bayesiana**: un grafo dirigido acíclico donde cada nodo tiene una **Tabla de Probabilidad Condicionada (CPT)** que describe su probabilidad en función del estado de sus padres. El motor de inferencia (`recalcAllMarginals`) calcula las marginales de cada nodo. La **inferencia exacta** enumera las combinaciones reales y está limitada a 20 nodos por su coste exponencial; por encima de ese tamaño se usa **Monte Carlo** (ponderación por verosimilitud) para una estimación aproximada con su margen de error. Las CPTs pueden definirse a mano o **aprenderse desde datos** (MLE cuando todas las variables están observadas, EM cuando hay variables ocultas).

**Por qué se ha usado.** Muchos riesgos reales no son una simple cadena lineal: las causas se combinan, hay factores externos (p. ej. condiciones meteorológicas o del mar) y, sobre todo, se dispone de **observaciones parciales** sobre las que hay que razonar. Las redes bayesianas son el formalismo estándar para esto: separan de forma limpia la sensibilidad de un sensor de su tasa de falsos positivos, propagan la evidencia por toda la red y permiten preguntar tanto hacia adelante (efecto) como hacia atrás (causa). Esto las hace ideales para escenarios como la fiabilidad de misiones espaciales o el diagnóstico de alarmas, donde lo importante no es solo detectar un evento sino estimar su significado real.

### Por qué dos modos complementarios

Ambos modos comparten el mismo lienzo y se eligen según la pregunta:

- Usa **Binomial** cuando el riesgo es una **secuencia de pasos** independientes de éxito/fallo y quieres una probabilidad final fácil de leer.
- Usa **Bayes** cuando hay **dependencias causales** entre variables y necesitas **actualizar las probabilidades a partir de evidencia** observada.

De hecho, ambos se combinan: en el ejemplo del Falcon 9, una distribución binomial resume la probabilidad de fallo de los 9 motores y la red bayesiana propaga ese riesgo por el resto del modelo.

---

## Cuándo usar cada nodo

### Nodos del modo Binomial

Arrastra estos elementos desde la paleta. El diagrama se lee como un flujo de izquierda a derecha (o de arriba abajo), desde el inicio hasta uno o varios finales.

| Nodo      | Color  | Cuándo usarlo                                                                                                                                                                                                                            | Conexiones permitidas                                               |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Start** | Verde  | Punto de entrada del proceso. Úsalo una vez como arranque del flujo. No representa un evento con probabilidad, solo el origen.                                                                                                           | Solo **sale** hacia _State_ o _Event_. No puede recibir conexiones. |
| **State** | Azul   | Estado intermedio por el que pasa el proceso sin que ocurra (todavía) un evento probabilístico. Útil para estructurar el camino o agrupar etapas.                                                                                        | Entra y sale hacia _State_ o _Event_.                               |
| **Event** | Morado | El nodo clave: representa un evento que ocurre con cierta **probabilidad** (campo `probability` editable en su banda inferior). Úsalo en cada paso donde haya éxito/fallo: "la cámara detecta el defecto", "la fase 2 tiene éxito", etc. | Entra y sale hacia _State_ o _Event_.                               |
| **End**   | Rojo   | Resultado final del flujo. Marca dónde termina un camino (éxito, rechazo, fallo…). Puedes tener varios.                                                                                                                                  | Solo **recibe** desde _State_ o _Event_. No puede salir.            |

**Conexiones (Binomial).** Cada flecha lleva un **peso** (`weight`, por defecto 1) que determina la probabilidad relativa de tomar esa rama frente a sus hermanas. Los pesos de las ramas que salen de un mismo nodo se pueden re-balancear automáticamente para repartir la probabilidad.

> Regla práctica: usa **Start** para arrancar, **Event** para cada decisión éxito/fallo con su probabilidad, **State** para pasos sin azar y **End** para cerrar cada desenlace.

### Nodos del modo Bayes

En Bayes todos los nodos son variables binarias (`Yes`/`No`) con su Tabla de Probabilidad Condicionada (CPT). Las flechas representan **dependencia causal** (padre → hijo), no un flujo. Los tres tipos solo se diferencian semánticamente y por color; cualquiera puede conectar con cualquiera.

| Nodo       | Color   | Cuándo usarlo                                                                                                                                                                                                              |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cause**  | Naranja | Causa raíz del modelo: una variable que no depende de otras (sin padres). Su CPT es su probabilidad inicial. Ejemplos: `RealSystemFailure`, `WeatherConditions`, `DeorbitBurnFailure`.                                     |
| **Effect** | Verde   | Efecto o resultado que **depende** del estado de sus padres. Suele ser el nodo final que te interesa consultar. Su CPT describe cómo cambia según los padres. Ejemplos: `CrewRescued`, `FailureIsReal`, `PayloadDeployed`. |
| **Event**  | Morado  | Nodo intermedio que es a la vez efecto de unos nodos y causa de otros. Encadena el razonamiento causal. Ejemplos: `MissionReachesOrbit`, `T0Alert`, `NormalSplashdown`.                                                    |

**Cómo trabajar con cada nodo (Bayes).** Doble clic sobre cualquiera abre su ventana para:

- Fijar **evidencia** (`Yes` / `?` / `No`): lo que has observado de esa variable.
- Editar su **CPT**: probabilidad inicial (nodos raíz) o condicionada al estado de los padres.
- Ver sus **marginales** actuales `P(=Yes)` / `P(=No)`, que se recalculan al introducir evidencia en cualquier nodo de la red.

**Conexiones (Bayes).** Una flecha de A a B significa "A es padre de B": el estado de A condiciona la CPT de B. Al añadir o quitar un padre, la CPT del hijo crece o se reduce (2^nº-de-padres filas).

> Regla práctica: empieza con los **Cause** (lo que origina el riesgo), encadena la lógica con **Event** y coloca como **Effect** la pregunta final que quieres responder. Después define las CPTs o apréndelas desde un CSV.
