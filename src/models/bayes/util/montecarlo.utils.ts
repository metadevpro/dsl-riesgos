import { BayesGraph, BayesEvidence, MCResult } from '../../types';
import { topologicalSort, recalcAllMarginals } from './bayesInference.utils';

// ─── Core Sampler ─────────────────────────────────────────────────────────────

function samplear(distribucion: Record<string, number>): string {
  const r = Math.random();
  let acumulado = 0;
  for (const [estado, prob] of Object.entries(distribucion)) {
    acumulado += prob;
    if (r < acumulado) return estado;
  }
  return Object.keys(distribucion).at(-1)!;
}

interface WeightedSample {
  muestra: Record<string, string>;
  peso: number;
}

/**
 * One likelihood-weighting pass: traverses the graph in topological order,
 * sampling non-evidence nodes from their CPT and accumulating the likelihood
 * weight from evidence nodes as the product of P(evidence | parents_sampled).
 * Returns the sample together with its weight.
 */
function muestrearLikelihoodWeighting(graph: BayesGraph, orden: string[], evidencias: Record<string, BayesEvidence>): WeightedSample {
  const muestra: Record<string, string> = {};
  let peso = 1;

  for (const nodoId of orden) {
    const nodo = graph.get(nodoId)!;
    const clave = nodo.parents.length === 0 ? 'prior' : nodo.parents.map((p) => `${p}_${muestra[p]}`).join('|');
    const distribucion = nodo.cpt[clave];

    const evidencia = evidencias[nodoId];
    if (evidencia != null) {
      muestra[nodoId] = evidencia;
      const probEvidencia = distribucion?.[evidencia] ?? 0;
      peso *= probEvidencia;
      if (peso === 0) {
        // Sample inconsistent with the network — short-circuit.
        for (const restante of orden) {
          if (muestra[restante] === undefined) muestra[restante] = evidencias[restante] ?? 'si';
        }
        return { muestra, peso: 0 };
      }
      continue;
    }

    if (!distribucion) {
      muestra[nodoId] = 'si';
      continue;
    }

    muestra[nodoId] = samplear({ si: distribucion.si, no: distribucion.no });
  }

  return { muestra, peso };
}

// ─── Monte Carlo Simulation (Likelihood Weighting) ────────────────────────────

export function ejecutarMonteCarlo(graph: BayesGraph, evidencias: Record<string, BayesEvidence>, nIteraciones = 1000): MCResult {
  const acumulados: Record<string, Record<string, number>> = {};
  for (const [nodoId] of graph) {
    acumulados[nodoId] = { si: 0, no: 0 };
  }

  const orden = topologicalSort(graph);
  let pesoTotal = 0;
  let muestrasNoNulas = 0;

  for (let i = 0; i < nIteraciones; i++) {
    const { muestra, peso } = muestrearLikelihoodWeighting(graph, orden, evidencias);
    if (peso <= 0) continue;

    muestrasNoNulas++;
    pesoTotal += peso;
    for (const [nodoId, estado] of Object.entries(muestra)) {
      if (acumulados[nodoId]?.[estado] !== undefined) {
        acumulados[nodoId][estado] += peso;
      }
    }
  }

  const probabilidades: Record<string, Record<string, number>> = {};
  for (const [nodoId, estados] of Object.entries(acumulados)) {
    probabilidades[nodoId] = {};
    if (pesoTotal <= 0) {
      probabilidades[nodoId]['si'] = 0;
      probabilidades[nodoId]['no'] = 0;
      continue;
    }
    for (const [estado, sumaPeso] of Object.entries(estados)) {
      probabilidades[nodoId][estado] = sumaPeso / pesoTotal;
    }
  }

  return { probabilidades, iteraciones: nIteraciones, exitosas: muestrasNoNulas };
}

// ─── Error vs Exact Inference ─────────────────────────────────────────────────

export function calcularError(
  teorico: Record<string, Record<string, number>>,
  empirico: Record<string, Record<string, number>>
): Record<string, Record<string, number>> {
  const errores: Record<string, Record<string, number>> = {};

  for (const nodoId of Object.keys(teorico)) {
    errores[nodoId] = {};
    for (const estado of Object.keys(teorico[nodoId])) {
      errores[nodoId][estado] = Math.abs((teorico[nodoId][estado] ?? 0) - (empirico[nodoId]?.[estado] ?? 0));
    }
  }

  return errores;
}

export function marginalesExactos(graph: BayesGraph): Record<string, Record<string, number>> {
  const grafoCopia = cloneGraph(graph);
  recalcAllMarginals(grafoCopia);
  const result: Record<string, Record<string, number>> = {};
  for (const [id, nodo] of grafoCopia) {
    result[id] = { si: nodo.marginals.si, no: nodo.marginals.no };
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneGraph(graph: BayesGraph): BayesGraph {
  const copia: BayesGraph = new Map();
  for (const [id, nodo] of graph) {
    copia.set(id, {
      ...nodo,
      parents: [...nodo.parents],
      children: [...nodo.children],
      cpt: Object.fromEntries(Object.entries(nodo.cpt).map(([k, v]) => [k, { ...v }])),
      marginals: { ...nodo.marginals }
    });
  }
  return copia;
}
