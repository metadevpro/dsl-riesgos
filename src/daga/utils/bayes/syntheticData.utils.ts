import { BayesGraph } from '../../types';
import { topologicalSort } from './bayesInference.utils';

export function generarDatosSinteticos(
    graph: BayesGraph,
    nMuestras: number = 1000,
    nodosOcultar: string[] = []
): string {
    const orden = topologicalSort(graph);
    const filas: Record<string, string>[] = [];

    for (let i = 0; i < nMuestras; i++) {
        const muestra = _muestrearUna(graph, orden);
        const fila: Record<string, string> = {};
        for (const nodoId of orden) {
            const nodo = graph.get(nodoId)!;
            fila[nodo.name] = nodosOcultar.includes(nodoId) ? '' : muestra[nodoId];
        }
        filas.push(fila);
    }

    const headers = orden.map(id => graph.get(id)!.name);
    const edgePairs: string[] = [];
    for (const childId of orden) {
        const childNode = graph.get(childId)!;
        for (const parentId of childNode.parents) {
            const parentName = graph.get(parentId)?.name;
            if (parentName) edgePairs.push(`${parentName}->${childNode.name}`);
        }
    }
    const edgesComment = edgePairs.length > 0
        ? `# edges: ${edgePairs.join('; ')}`
        : '# edges:';

    return [
        edgesComment,
        headers.join(','),
        ...filas.map(f => headers.map(h => f[h] ?? '').join(','))
    ].join('\n');
}

function _muestrearUna(graph: BayesGraph, orden: string[]): Record<string, string> {
    const muestra: Record<string, string> = {};

    for (const nodoId of orden) {
        const nodo = graph.get(nodoId)!;
        const clave = nodo.parents.length === 0
            ? 'prior'
            : nodo.parents.map(p => `${p}_${muestra[p]}`).join('|');

        const dist = nodo.cpt[clave];
        muestra[nodoId] = dist ? _samplear({ si: dist.si, no: dist.no }) : 'si';
    }

    return muestra;
}

function _samplear(distribucion: Record<string, number>): string {
    const r = Math.random();
    let acumulado = 0;
    for (const [estado, prob] of Object.entries(distribucion)) {
        acumulado += prob;
        if (r < acumulado) return estado;
    }
    return Object.keys(distribucion).at(-1)!;
}
