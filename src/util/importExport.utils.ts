import { DagaExporter, DagaImporter, DagaModel, DagaNode } from '@metadev/daga';
import { Canvas } from '@metadev/daga-angular';
import { BayesCPT, BayesEvidence, BayesGraph } from '../models/types';

export type RiskModelType = 'binomial' | 'bayes';

export interface BayesNodeSchema {
  evidence: BayesEvidence;
  cpt: BayesCPT;
}

export interface BayesExportSchema {
  nodes: Record<string, BayesNodeSchema>;
}

export interface RiskFile {
  riskFileVersion: 1;
  modelType: RiskModelType;
  exportedAt: string;
  daga: DagaModel;
  bayes?: BayesExportSchema;
}

export function serializeBayesGraph(graph: BayesGraph): BayesExportSchema {
  const nodes: Record<string, BayesNodeSchema> = {};
  for (const [id, node] of graph) {
    nodes[id] = {
      evidence: node.evidence,
      cpt: Object.fromEntries(Object.entries(node.cpt).map(([k, v]) => [k, { si: v.si, no: v.no }]))
    };
  }
  return { nodes };
}

export function overlayBayesSchemaOnGraph(graph: BayesGraph, schema: BayesExportSchema | undefined): void {
  if (!schema || !schema.nodes) return;
  for (const [id, entry] of Object.entries(schema.nodes)) {
    const node = graph.get(id);
    if (!node) continue;
    if (entry.evidence === 'si' || entry.evidence === 'no' || entry.evidence === null) {
      node.evidence = entry.evidence;
    }
    if (entry.cpt && typeof entry.cpt === 'object') {
      node.cpt = entry.cpt;
    }
  }
}

const BINOMIAL_NODE_TYPES = new Set(['event-diagram-node', 'state-diagram-node']);

export function exportCanvasToFile(canvas: Canvas, modelType: RiskModelType): RiskFile {
  const daga = new DagaExporter().export(canvas.model);
  return {
    riskFileVersion: 1,
    modelType,
    exportedAt: new Date().toISOString(),
    daga
  };
}

export function downloadRiskFile(file: RiskFile, baseName?: string): void {
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = file.exportedAt.replace(/[:.]/g, '-');
  a.href = url;
  a.download = `${baseName ?? file.modelType}-diagram-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseRiskFile(text: string): RiskFile {
  const parsed = JSON.parse(text) as Partial<RiskFile>;
  if (!parsed || parsed.riskFileVersion !== 1) {
    throw new Error('Formato no soportado: falta riskFileVersion=1.');
  }
  if (!parsed.daga || !Array.isArray(parsed.daga.nodes) || !Array.isArray(parsed.daga.connections)) {
    throw new Error('Archivo inválido: falta sección daga.nodes / daga.connections.');
  }
  const modelType: RiskModelType =
    parsed.modelType === 'binomial' || parsed.modelType === 'bayes' ? parsed.modelType : detectModelType(parsed.daga);
  migrateLegacyValueKeys(parsed.daga);
  return {
    riskFileVersion: 1,
    modelType,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    daga: parsed.daga,
    bayes: parsed.bayes
  };
}

export function readRiskFile(file: File): Promise<RiskFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      try {
        resolve(parseRiskFile(reader.result as string));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.readAsText(file);
  });
}

/** Fetches a RiskFile JSON from a served URL (e.g. an example under /assets). */
export async function loadRiskFileFromUrl(url: string): Promise<RiskFile> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo cargar el modelo (${res.status}): ${url}`);
  }
  return parseRiskFile(await res.text());
}

export function detectModelType(daga: DagaModel): RiskModelType {
  const nodes: DagaNode[] = daga.nodes ?? [];
  for (const node of nodes) {
    if (BINOMIAL_NODE_TYPES.has(node.type)) {
      return 'binomial';
    }
  }
  return 'bayes';
}

/**
 * Rewrites legacy alias keys to the canonical pair so the calculation utils
 * only need to read one key. Connections: `chance` / `probability` -> `weight`.
 * Nodes: `chance` -> `probability`.
 */
function migrateLegacyValueKeys(daga: DagaModel): void {
  const rewriteValues = (values: Record<string, unknown> | undefined, canonical: string, aliases: string[]): void => {
    if (!values || typeof values !== 'object') return;
    if (values[canonical] !== undefined) {
      for (const alias of aliases) delete values[alias];
      return;
    }
    for (const alias of aliases) {
      if (values[alias] !== undefined) {
        values[canonical] = values[alias];
        delete values[alias];
        break;
      }
    }
  };

  const walkValueSet = (item: unknown, canonical: string, aliases: string[]): void => {
    if (!item || typeof item !== 'object') return;
    const valueSet = (item as Record<string, unknown>)['valueSet'];
    if (valueSet && typeof valueSet === 'object') {
      const values = (valueSet as Record<string, unknown>)['values'] as Record<string, unknown> | undefined;
      rewriteValues(values, canonical, aliases);
    }
    const data = (item as Record<string, unknown>)['data'] as Record<string, unknown> | undefined;
    rewriteValues(data, canonical, aliases);
  };

  for (const conn of daga.connections ?? []) {
    walkValueSet(conn, 'weight', ['chance', 'probability']);
  }
  for (const node of daga.nodes ?? []) {
    walkValueSet(node, 'probability', ['chance']);
  }
}

const BAYES_LEGACY_NODE_TYPE = 'diagram-node';
const BAYES_DEFAULT_NODE_TYPE = 'event-diagram-node';

export function applyRiskFileToCanvas(canvas: Canvas, file: RiskFile): void {
  if (file.modelType === 'bayes') {
    remapLegacyBayesNodeTypes(file.daga);
  }
  canvas.model.clear();
  new DagaImporter().import(canvas.model, file.daga);
  canvas.updateModelInView();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => fitCanvasToContent(canvas));
  } else {
    fitCanvasToContent(canvas);
  }
}

/**
 * Encuadra el diagrama (fit-to-content) midiendo el viewport real.
 * Sustituye a canvas.center(), cuyo cálculo de tamaño de ventana es erróneo
 * cuando el grid está activo (mide el <rect> del patrón en <defs>, ~50px).
 */
export function fitCanvasToContent(canvas: Canvas, maxZoom = 1, padding = 0.9): void {
  const nodes = canvas.model.nodes.all();
  if (nodes.length === 0) return;

  const svg = canvas.selectSVGElement().node();
  const view = svg?.getBoundingClientRect();
  const windowW = view?.width ?? 0;
  const windowH = view?.height ?? 0;
  if (windowW < 1 || windowH < 1) return; // viewport aún sin layout

  const minX = Math.min(...nodes.map((n) => n.coords[0]));
  const maxX = Math.max(...nodes.map((n) => n.coords[0] + n.width));
  const minY = Math.min(...nodes.map((n) => n.coords[1]));
  const maxY = Math.max(...nodes.map((n) => n.coords[1] + n.height));
  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);

  const zoom = Math.min(windowW / rangeX, windowH / rangeY, maxZoom) * padding;
  canvas.zoomAndPanTo((minX + maxX) / 2, (minY + maxY) / 2, zoom, 0);
}

function remapLegacyBayesNodeTypes(daga: DagaModel): void {
  for (const node of daga.nodes ?? []) {
    if (node.type === BAYES_LEGACY_NODE_TYPE) {
      node.type = BAYES_DEFAULT_NODE_TYPE;
    }
  }
}
