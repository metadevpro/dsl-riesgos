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

function muestrearRed(
    graph: BayesGraph,
    evidencias: Record<string, BayesEvidence>
): Record<string, string> {
    const orden = topologicalSort(graph);
    const muestra: Record<string, string> = {};

    for (const nodoId of orden) {
        if (evidencias[nodoId] != null) {
            muestra[nodoId] = evidencias[nodoId] as string;
            continue;
        }

        const nodo = graph.get(nodoId)!;
        let clave: string;

        if (nodo.parents.length === 0) {
            clave = 'prior';
        } else {
            clave = nodo.parents.map(p => `${p}_${muestra[p]}`).join('|');
        }

        const distribucion = nodo.cpt[clave];
        if (!distribucion) {
            muestra[nodoId] = 'si';
            continue;
        }

        muestra[nodoId] = samplear({ si: distribucion.si, no: distribucion.no });
    }

    return muestra;
}

// ─── Monte Carlo Simulation ───────────────────────────────────────────────────

export function ejecutarMonteCarlo(
    graph: BayesGraph,
    evidencias: Record<string, BayesEvidence>,
    nIteraciones = 1000
): MCResult {
    const conteos: Record<string, Record<string, number>> = {};

    for (const [nodoId] of graph) {
        conteos[nodoId] = { si: 0, no: 0 };
    }

    for (let i = 0; i < nIteraciones; i++) {
        const muestra = muestrearRed(graph, evidencias);
        for (const [nodoId, estado] of Object.entries(muestra)) {
            if (conteos[nodoId]?.[estado] !== undefined) {
                conteos[nodoId][estado]++;
            }
        }
    }

    const probabilidades: Record<string, Record<string, number>> = {};
    for (const [nodoId, estados] of Object.entries(conteos)) {
        const total = Object.values(estados).reduce((s, c) => s + c, 0);
        probabilidades[nodoId] = {};
        for (const [estado, count] of Object.entries(estados)) {
            probabilidades[nodoId][estado] = total > 0 ? count / total : 0;
        }
    }

    return { probabilidades, iteraciones: nIteraciones, exitosas: nIteraciones };
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
            errores[nodoId][estado] = Math.abs(
                (teorico[nodoId][estado] ?? 0) - (empirico[nodoId]?.[estado] ?? 0)
            );
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
            cpt: Object.fromEntries(
                Object.entries(nodo.cpt).map(([k, v]) => [k, { ...v }])
            ),
            marginals: { ...nodo.marginals }
        });
    }
    return copia;
}
