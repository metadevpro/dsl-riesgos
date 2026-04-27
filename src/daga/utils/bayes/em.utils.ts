import { BayesGraph, BayesCPT, BayesNodeInfo } from '../../types';
import { getParentCombinations, recalcAllMarginals, topologicalSort } from './bayesInference.utils';
import { normalizarValor } from './csv.utils';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export interface EMOpciones {
    maxIter?: number;
    tolerancia?: number;
    onProgreso?: (iter: number, delta: number) => void;
}

export async function aprenderEM(
    graph: BayesGraph,
    datos: Record<string, string>[],
    opciones: EMOpciones = {}
): Promise<BayesGraph> {
    const { maxIter = 50, tolerancia = 0.001, onProgreso = null } = opciones;

    let redActual = inicializarUniforme(graph);

    for (let iter = 0; iter < maxIter; iter++) {
        // ── E-STEP ──────────────────────────────────────────────────────────
        const datosAnotados = datos.map(fila => {
            const evidencias: Record<string, string> = {};

            for (const [id, nodo] of redActual) {
                const val = normalizarValor(fila[nodo.name.toLowerCase()] ?? '', nodo);
                if (val) evidencias[id] = val;
            }

            // Clone graph with only the evidence from this row
            const grafoEvidencia = _clonarConEvidencia(redActual, evidencias);
            const inferido = _inferirMarginals(grafoEvidencia);

            return { fila, evidencias, inferido };
        });

        // ── M-STEP ──────────────────────────────────────────────────────────
        const redNueva = mStep(redActual, datosAnotados);

        // ── CONVERGENCIA ─────────────────────────────────────────────────────
        const delta = calcularDelta(redActual, redNueva);
        redActual = redNueva;

        if (onProgreso) onProgreso(iter + 1, delta);

        // Yield to avoid blocking UI on large datasets
        await new Promise(r => setTimeout(r, 0));

        if (delta < tolerancia) break;
    }

    return redActual;
}

// ─── M-Step ──────────────────────────────────────────────────────────────────

export function mStep(
    graph: BayesGraph,
    datosAnotados: { fila: Record<string, string>; evidencias: Record<string, string>; inferido: Record<string, Record<string, number>> }[],
    suavizado: number = 1
): BayesGraph {
    const nodosActualizados: BayesGraph = new Map();

    for (const [nodoId, nodo] of graph) {
        const combis = getParentCombinations(nodo.parents);
        const conteos: Record<string, Record<string, number>> = {};

        for (const combi of combis) {
            const clave = combi.length === 0
                ? 'prior'
                : combi.map(c => `${c.parentId}_${c.state}`).join('|');
            conteos[clave] = { si: suavizado, no: suavizado };
        }

        for (const { evidencias, inferido } of datosAnotados) {
            // Distribution for this node in this row
            const distNodo: Record<string, number> = evidencias[nodoId]
                ? { si: evidencias[nodoId] === 'si' ? 1 : 0, no: evidencias[nodoId] === 'no' ? 1 : 0 }
                : (inferido[nodoId] ?? { si: 0.5, no: 0.5 });

            // Weighted parent-key contributions
            const clavesConPeso = calcularClavePadres(nodo, evidencias, inferido, graph);

            for (const [clave, peso] of clavesConPeso) {
                if (!conteos[clave]) continue;
                conteos[clave]['si'] += (distNodo['si'] ?? 0) * peso;
                conteos[clave]['no'] += (distNodo['no'] ?? 0) * peso;
            }
        }

        nodosActualizados.set(nodoId, { 
            ...nodo, 
            cpt: _normalizar(conteos),
            marginals: { ...nodo.marginals }
        });
    }

    return nodosActualizados;
}

// ─── Parent Key Weighting ─────────────────────────────────────────────────────

export function calcularClavePadres(
    nodo: BayesNodeInfo,
    evidencias: Record<string, string>,
    inferido: Record<string, Record<string, number>>,
    graph: BayesGraph
): [string, number][] {
    if (nodo.parents.length === 0) return [['prior', 1]];

    const distsPadres = nodo.parents.map(padreId => {
        if (evidencias[padreId]) {
            const padre = graph.get(padreId)!;
            return Object.fromEntries(
                ['si', 'no'].map(e => [e, e === evidencias[padreId] ? 1 : 0])
            );
        }
        return inferido[padreId] ?? { si: 0.5, no: 0.5 };
    });

    const combis = getParentCombinations(nodo.parents);

    return combis
        .map(combi => {
            const clave = combi.map(c => `${c.parentId}_${c.state}`).join('|');
            const peso = combi.reduce((p, c, i) => p * (distsPadres[i][c.state] ?? 0), 1);
            return [clave, peso] as [string, number];
        })
        .filter(([, peso]) => peso > 0.0001);
}

// ─── Convergence ──────────────────────────────────────────────────────────────

export function calcularDelta(redA: BayesGraph, redB: BayesGraph): number {
    let maxDelta = 0;

    for (const [id, nodoA] of redA) {
        const nodoB = redB.get(id);
        if (!nodoB) continue;

        for (const [clave, entryA] of Object.entries(nodoA.cpt)) {
            const entryB = nodoB.cpt[clave];
            if (!entryB) continue;
            maxDelta = Math.max(maxDelta, Math.abs(entryA.si - entryB.si));
        }
    }

    return maxDelta;
}

// ─── Initialization ───────────────────────────────────────────────────────────

export function inicializarUniforme(graph: BayesGraph): BayesGraph {
    const uniforme: BayesGraph = new Map();

    for (const [id, nodo] of graph) {
        const nuevaCPT: BayesCPT = {};
        for (const clave of Object.keys(nodo.cpt)) {
            nuevaCPT[clave] = { si: 0.5, no: 0.5 };
        }
        uniforme.set(id, { 
            ...nodo, 
            cpt: nuevaCPT,
            marginals: { ...nodo.marginals }
        });
    }

    return uniforme;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _clonarConEvidencia(
    graph: BayesGraph,
    evidencias: Record<string, string>
): BayesGraph {
    const copia: BayesGraph = new Map();
    for (const [id, nodo] of graph) {
        const ev = evidencias[id];
        copia.set(id, {
            ...nodo,
            parents: [...nodo.parents],
            children: [...nodo.children],
            cpt: Object.fromEntries(Object.entries(nodo.cpt).map(([k, v]) => [k, { ...v }])),
            marginals: { ...nodo.marginals },
            evidence: (ev === 'si' || ev === 'no') ? ev : null
        });
    }
    return copia;
}

function _inferirMarginals(graph: BayesGraph): Record<string, Record<string, number>> {
    recalcAllMarginals(graph);
    const result: Record<string, Record<string, number>> = {};
    for (const [id, nodo] of graph) {
        result[id] = { si: nodo.marginals.si, no: nodo.marginals.no };
    }
    return result;
}

function _normalizar(conteos: Record<string, Record<string, number>>): BayesCPT {
    const cpt: BayesCPT = {};
    for (const [clave, c] of Object.entries(conteos)) {
        const total = (c['si'] ?? 0) + (c['no'] ?? 0);
        const si = total > 0 ? Math.round((c['si'] / total) * 1e5) / 1e5 : 0.5;
        const no = total > 0 ? Math.round((1 - si) * 1e5) / 1e5 : 0.5;
        cpt[clave] = { si, no };
    }
    return cpt;
}
