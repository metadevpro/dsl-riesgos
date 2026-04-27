import { DiagramLayout, DiagramModel, DiagramNode } from '@metadev/daga-angular';

export interface BayesCausalLayoutOptions {
  columnGap?: number;
  rowGap?: number;
  originX?: number;
  originY?: number;
}

export class BayesCausalLayout implements DiagramLayout {
  private readonly columnGap: number;
  private readonly rowGap: number;
  private readonly originX: number;
  private readonly originY: number;

  constructor(options: BayesCausalLayoutOptions = {}) {
    this.columnGap = options.columnGap ?? 80;
    this.rowGap = options.rowGap ?? 60;
    this.originX = options.originX ?? 50;
    this.originY = options.originY ?? 50;
  }

  apply(model: DiagramModel): DiagramModel {
    const nodes: DiagramNode[] = model.nodes.all().filter((n) => !n.removed);
    if (nodes.length === 0) return model;

    const parents = new Map<string, Set<string>>();
    const children = new Map<string, Set<string>>();
    for (const n of nodes) {
      parents.set(n.id, new Set());
      children.set(n.id, new Set());
    }

    for (const conn of model.connections.all().filter((c) => !c.removed)) {
      const startNode = conn.start?.getNode();
      const endNode = conn.end?.getNode();
      if (!startNode || !endNode) continue;
      if (!parents.has(endNode.id) || !children.has(startNode.id)) continue;
      parents.get(endNode.id)!.add(startNode.id);
      children.get(startNode.id)!.add(endNode.id);
    }

    const layer = new Map<string, number>();
    const computeLayer = (id: string, stack: Set<string>): number => {
      if (layer.has(id)) return layer.get(id)!;
      if (stack.has(id)) return 0;
      stack.add(id);
      const ps = parents.get(id)!;
      let maxParent = -1;
      for (const p of ps) {
        const pl = computeLayer(p, stack);
        if (pl > maxParent) maxParent = pl;
      }
      stack.delete(id);
      const l = maxParent + 1;
      layer.set(id, l);
      return l;
    };
    for (const n of nodes) computeLayer(n.id, new Set());

    const byLayer = new Map<number, DiagramNode[]>();
    for (const n of nodes) {
      const l = layer.get(n.id)!;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)!.push(n);
    }

    const layerIndices = Array.from(byLayer.keys()).sort((a, b) => a - b);

    const avgChildLayerOrder = (n: DiagramNode, orderInLayer: Map<string, number>): number => {
      const ch = Array.from(children.get(n.id)!);
      if (ch.length === 0) return Number.POSITIVE_INFINITY;
      const orders = ch.map((c) => orderInLayer.get(c) ?? 0);
      return orders.reduce((a, b) => a + b, 0) / orders.length;
    };

    const order = new Map<string, number>();
    for (let i = layerIndices.length - 1; i >= 0; i--) {
      const l = layerIndices[i];
      const arr = byLayer.get(l)!;
      arr.sort((a, b) => {
        const ao = avgChildLayerOrder(a, order);
        const bo = avgChildLayerOrder(b, order);
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '');
      });
      arr.forEach((n, idx) => order.set(n.id, idx));
    }

    const colWidths = layerIndices.map((l) =>
      Math.max(...byLayer.get(l)!.map((n) => n.width || 200)),
    );
    const colXs: number[] = [];
    let x = this.originX;
    for (let i = 0; i < layerIndices.length; i++) {
      colXs.push(x);
      x += colWidths[i] + this.columnGap;
    }

    const colHeights = layerIndices.map((l) => {
      const arr = byLayer.get(l)!;
      return arr.reduce((s, n) => s + (n.height || 100), 0) + this.rowGap * Math.max(0, arr.length - 1);
    });
    const totalHeight = Math.max(...colHeights);

    for (let i = 0; i < layerIndices.length; i++) {
      const l = layerIndices[i];
      const arr = byLayer.get(l)!;
      const hSum = colHeights[i];
      let y = this.originY + (totalHeight - hSum) / 2;
      const colX = colXs[i];
      const colW = colWidths[i];
      for (const n of arr) {
        const nx = colX + (colW - (n.width || 200)) / 2;
        n.move([nx, y]);
        y += (n.height || 100) + this.rowGap;
      }
    }

    return model;
  }
}
