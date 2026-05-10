import { Canvas } from '@metadev/daga-angular';
import { DagaExporter, DagaImporter, DagaModel, DagaNode } from '@metadev/daga';

export type RiskModelType = 'binomial' | 'bayes';

export interface RiskFile {
  riskFileVersion: 1;
  modelType: RiskModelType;
  exportedAt: string;
  daga: DagaModel;
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

export function readRiskFile(file: File): Promise<RiskFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as Partial<RiskFile>;
        if (!parsed || parsed.riskFileVersion !== 1) {
          throw new Error('Formato no soportado: falta riskFileVersion=1.');
        }
        if (!parsed.daga || !Array.isArray(parsed.daga.nodes) || !Array.isArray(parsed.daga.connections)) {
          throw new Error('Archivo inválido: falta sección daga.nodes / daga.connections.');
        }
        const modelType: RiskModelType =
          parsed.modelType === 'binomial' || parsed.modelType === 'bayes' ? parsed.modelType : detectModelType(parsed.daga);
        resolve({
          riskFileVersion: 1,
          modelType,
          exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
          daga: parsed.daga
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.readAsText(file);
  });
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

export function applyRiskFileToCanvas(canvas: Canvas, file: RiskFile): void {
  canvas.model.clear();
  new DagaImporter().import(canvas.model, file.daga);
  canvas.updateModelInView();
  canvas.center(undefined, 1, 300);
}
