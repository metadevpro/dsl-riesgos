/**
 * Simple structure learning for binary Bayesian networks.
 * Chow-Liu algorithm: maximum spanning tree over pairwise mutual information.
 */

function normalizeBinary(v: string | undefined): 'si' | 'no' | null {
    if (!v) return null;
    const s = String(v).toLowerCase().trim();
    if (s === 'si' || s === 'yes' || s === 'true' || s === '1') return 'si';
    if (s === 'no' || s === 'false' || s === '0') return 'no';
    return null;
}

function mutualInformationBinary(
    data: Record<string, string>[],
    a: string,
    b: string
): number {
    const counts: Record<string, number> = {};
    const ca: Record<string, number> = {};
    const cb: Record<string, number> = {};
    let total = 0;

    for (const row of data) {
        const va = normalizeBinary(row[a]);
        const vb = normalizeBinary(row[b]);
        if (va == null || vb == null) continue;
        const key = `${va}|${vb}`;
        counts[key] = (counts[key] || 0) + 1;
        ca[va] = (ca[va] || 0) + 1;
        cb[vb] = (cb[vb] || 0) + 1;
        total++;
    }
    if (total === 0) return 0;

    let mi = 0;
    for (const key of Object.keys(counts)) {
        const [va, vb] = key.split('|');
        const pxy = counts[key] / total;
        const px = ca[va] / total;
        const py = cb[vb] / total;
        if (pxy > 0 && px > 0 && py > 0) {
            mi += pxy * Math.log2(pxy / (px * py));
        }
    }
    return mi;
}

/**
 * Builds a Chow-Liu maximum spanning tree over the given variables.
 * Variables correspond to keys in the data rows.
 * Returns undirected edges.
 */
export function chowLiuTree(
    data: Record<string, string>[],
    variables: string[]
): [string, string][] {
    if (variables.length < 2) return [];

    const edges: { a: string; b: string; mi: number }[] = [];
    for (let i = 0; i < variables.length; i++) {
        for (let j = i + 1; j < variables.length; j++) {
            const mi = mutualInformationBinary(data, variables[i], variables[j]);
            edges.push({ a: variables[i], b: variables[j], mi });
        }
    }
    edges.sort((x, y) => y.mi - x.mi);

    const parent = new Map<string, string>();
    variables.forEach(v => parent.set(v, v));
    const find = (x: string): string => {
        while (parent.get(x) !== x) {
            parent.set(x, parent.get(parent.get(x)!)!);
            x = parent.get(x)!;
        }
        return x;
    };
    const union = (x: string, y: string): boolean => {
        const rx = find(x), ry = find(y);
        if (rx === ry) return false;
        parent.set(rx, ry);
        return true;
    };

    const tree: [string, string][] = [];
    for (const e of edges) {
        if (union(e.a, e.b)) tree.push([e.a, e.b]);
        if (tree.length === variables.length - 1) break;
    }
    return tree;
}

/**
 * Orients an undirected tree as a rooted DAG by BFS from the given root.
 * All edges point away from the root.
 */
export function orientTreeFromRoot(
    edges: [string, string][],
    root: string
): [string, string][] {
    const adj = new Map<string, string[]>();
    for (const [a, b] of edges) {
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a)!.push(b);
        adj.get(b)!.push(a);
    }

    const directed: [string, string][] = [];
    const visited = new Set<string>([root]);
    const queue = [root];
    while (queue.length > 0) {
        const u = queue.shift()!;
        for (const v of (adj.get(u) || [])) {
            if (!visited.has(v)) {
                visited.add(v);
                directed.push([u, v]);
                queue.push(v);
            }
        }
    }
    return directed;
}
