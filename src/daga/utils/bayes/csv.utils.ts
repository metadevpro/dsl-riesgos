import { BayesGraph, BayesNodeInfo } from '../../types';

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

export function parsearCSV(texto: string): Record<string, string>[] {
    const lineas = texto.trim().split('\n').filter(l => !l.trim().startsWith('#'));
    if (lineas.length < 2) return [];

    const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());

    return lineas.slice(1).map(linea => {
        const valores = linea.split(',').map(v => v.trim().toLowerCase());
        return Object.fromEntries(
            headers.map((h, i) => [h, valores[i] || ''])
        );
    });
}

/**
 * Extracts comment lines (starting with '#') from raw CSV text.
 */
export function extraerComentarios(texto: string): string[] {
    return texto.split(/\r?\n/).filter(l => l.trim().startsWith('#')).map(l => l.trim());
}

/**
 * Parses edges from a comment line of the form:
 *   # edges: Parent->Child; Parent->Child
 * Returns pairs of original names (case-preserved).
 */
export function parsearEdgesDesdeComentarios(comentarios: string[]): [string, string][] {
    const edges: [string, string][] = [];
    for (const line of comentarios) {
        const match = line.match(/^#\s*edges\s*:\s*(.+)$/i);
        if (!match) continue;
        const items = match[1].split(/[;,]/);
        for (const item of items) {
            const m = item.match(/\s*(.+?)\s*->\s*(.+?)\s*$/);
            if (m) edges.push([m[1].trim(), m[2].trim()]);
        }
    }
    return edges;
}

// ─── Column → Node Mapping ────────────────────────────────────────────────────

export interface CSVAnalysis {
    observados: string[];
    ocultos: string[];
    sinMapeo: string[];
}

export function analizarCSV(graph: BayesGraph, headers: string[]): CSVAnalysis {
    const nombreAId = new Map<string, string>();
    for (const [id, nodo] of graph) {
        nombreAId.set(nodo.name.toLowerCase(), id);
    }

    const observados: string[] = [];
    const ocultos: string[] = [];
    const sinMapeo: string[] = [];

    for (const [id, nodo] of graph) {
        const key = nodo.name.toLowerCase();
        if (headers.includes(key)) {
            observados.push(id);
        } else {
            ocultos.push(id);
        }
    }

    for (const h of headers) {
        if (!nombreAId.has(h)) sinMapeo.push(h);
    }

    if (sinMapeo.length > 0) {
        console.warn('[CSV] Columnas sin nodo correspondiente:', sinMapeo);
    }

    return { observados, ocultos, sinMapeo };
}

// ─── Value Normalization ──────────────────────────────────────────────────────

const MAPEOS_COMUNES: Record<string, string> = {
    yes: 'si', true: 'si', '1': 'si',
    no: 'no', false: 'no', '0': 'no'
};

export function normalizarValor(valor: string, nodo: BayesNodeInfo): string | null {
    if (!valor) return null;
    const v = valor.toLowerCase().trim();

    // Direct match against CPT states (si/no)
    if (v === 'si' || v === 'no') return v;

    // Common mappings
    const mapeado = MAPEOS_COMUNES[v];
    if (mapeado) return mapeado;

    return null;
}
