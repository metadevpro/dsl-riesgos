import { BayesGraph, BayesCPT } from '../../types';
import { getParentCombinations } from './bayesInference.utils';
import { normalizarValor } from './csv.utils';

export function aprenderMLE(graph: BayesGraph, datos: Record<string, string>[], suavizado = 1): BayesGraph {
  const nodosActualizados: BayesGraph = new Map();

  for (const [nodoId, nodo] of graph) {
    const combis = getParentCombinations(nodo.parents);
    const conteos: Record<string, { si: number; no: number }> = {};

    // Initialize with Laplace smoothing
    for (const combi of combis) {
      const clave = combi.length === 0 ? 'prior' : combi.map((c) => `${c.parentId}_${c.state}`).join('|');
      conteos[clave] = { si: suavizado, no: suavizado };
    }

    // Count observations
    for (const fila of datos) {
      const estadoNodo = normalizarValor(fila[nodo.name.toLowerCase()] ?? '', nodo);
      if (!estadoNodo) continue;

      const clavePartes: string[] = [];
      let filaValida = true;

      for (const padreId of nodo.parents) {
        const padre = graph.get(padreId)!;
        const estadoPadre = normalizarValor(fila[padre.name.toLowerCase()] ?? '', padre);
        if (!estadoPadre) {
          filaValida = false;
          break;
        }
        clavePartes.push(`${padreId}_${estadoPadre}`);
      }

      if (!filaValida) continue;

      const clave = clavePartes.length === 0 ? 'prior' : clavePartes.join('|');
      if (conteos[clave]) {
        (conteos[clave] as any)[estadoNodo]++;
      }
    }

    // Normalize counts → CPT
    const nuevaCPT = _normalizar(conteos);
    nodosActualizados.set(nodoId, {
      ...nodo,
      cpt: nuevaCPT,
      marginals: { ...nodo.marginals }
    });
  }

  return nodosActualizados;
}

function _normalizar(conteos: Record<string, { si: number; no: number }>): BayesCPT {
  const cpt: BayesCPT = {};
  for (const [clave, c] of Object.entries(conteos)) {
    const total = c.si + c.no;
    const si = total > 0 ? Math.round((c.si / total) * 1e5) / 1e5 : 0.5;
    const no = total > 0 ? Math.round((1 - si) * 1e5) / 1e5 : 0.5;
    cpt[clave] = { si, no };
  }
  return cpt;
}
