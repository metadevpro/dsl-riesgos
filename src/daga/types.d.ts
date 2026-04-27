export interface NodeInfo {
  id: string;
  data: any;
  [key: string]: any;
}

export interface ConnectionInfo {
  startNode?: string;
  endNode?: string;
  [key: string]: any;
}

export interface ConnectionEndpoints {
  startId?: string;
  endId?: string;
}

export type NodeId = string;

export interface pathProbabilityPathResult {
  nodeIds: NodeId[];
  probability: number;
}

export interface pathProbabilityCalculationResult {
  startNodeId: NodeId;
  startNodeName?: string;
  endNodeId: NodeId;
  posteriorProbability: number;
  pathCount: number;
  paths: pathProbabilityPathResult[];
}

export interface CalculationResult {
  startNodeId?: string;
  startNodeName?: string;
  iterations: number;
  successIterations: number;
}

export type BayesEvidence = 'si' | 'no' | null;

export interface BayesCPTEntry {
  si: number;
  no: number;
}

/** CPT keyed by parent-state combination string, e.g. "fumador_si|contaminacion_no" */
export type BayesCPT = Record<string, BayesCPTEntry>;

export interface BayesNodeInfo {
  id: string;
  name: string;
  parents: string[];
  children: string[];
  evidence: BayesEvidence;
  cpt: BayesCPT;
  marginals: BayesCPTEntry;
}

export type BayesGraph = Map<string, BayesNodeInfo>;

export interface CPTTableRow {
  key: string;
  parentStates: {
    parentName: string;
    stateLabel: string;
  }[];
  pSi: number;
  pNo: number;
  isValid: boolean;
}

export interface SimulationResult {
  startNodeId?: string;
  startNodeName?: string;
  iterations: number;
  successIterations: number;
  date: Date;
}

export interface MCResult {
  probabilidades: Record<string, Record<string, number>>;
  iteraciones: number;
  exitosas: number;
}

export interface LearningResult {
  metodo: 'MLE' | 'EM';
  graph: BayesGraph;
  ocultos: string[];
}
