import { recalcAllMarginals } from './bayesInference.utils';
import { BayesGraph } from '../../types';

describe('BayesInference Utility (Flujo de verify.ts)', () => {
  let graph: BayesGraph;

  beforeEach(() => {
    // Inicializamos el grafo tal cual está en verify.ts
    graph = new Map();
    
    graph.set('B', { id: 'B', name: 'Burglary', parents: [], children: ['A'], evidence: null, cpt: { prior: { si: 0.001, no: 0.999 } }, marginals: { si: 0, no: 0 } });
    graph.set('E', { id: 'E', name: 'Earthquake', parents: [], children: ['A'], evidence: null, cpt: { prior: { si: 0.002, no: 0.998 } }, marginals: { si: 0, no: 0 } });
    
    graph.set('A', { id: 'A', name: 'Alarm', parents: ['B', 'E'], children: ['J', 'M'], evidence: null, 
      cpt: {
        'B_si|E_si': { si: 0.950, no: 0.050 },
        'B_si|E_no': { si: 0.940, no: 0.060 },
        'B_no|E_si': { si: 0.290, no: 0.710 },
        'B_no|E_no': { si: 0.001, no: 0.999 },
      }, 
      marginals: { si: 0, no: 0 } 
    });
    
    graph.set('J', { id: 'J', name: 'JohnCalls', parents: ['A'], children: [], evidence: null, 
      cpt: {
        'A_si': { si: 0.900, no: 0.100 },
        'A_no': { si: 0.050, no: 0.950 },
      }, 
      marginals: { si: 0, no: 0 } 
    });
    
    graph.set('M', { id: 'M', name: 'MaryCalls', parents: ['A'], children: [], evidence: null, 
      cpt: {
        'A_si': { si: 0.700, no: 0.300 },
        'A_no': { si: 0.010, no: 0.990 },
      }, 
      marginals: { si: 0, no: 0 } 
    });
  });

  it('debe calcular correctamente la probabilidad marginal inicial de la Alarma', () => {
    recalcAllMarginals(graph);
    
    const pAlarmS = graph.get('A')!.marginals.si;
    
    // Debería ser aproximadamente un valor válido de probabilidad entre 0 y 1
    expect(pAlarmS).toBeGreaterThan(0);
    expect(pAlarmS).toBeLessThan(1);
    
    // Generalmente para esta red de ejemplo clásica, P(Alarm=si) ≈ 0.0025
    expect(pAlarmS).toBeCloseTo(0.0025, 3);
  });

  it('debe calcular la probabilidad de Burglary dada la evidencia de John y Mary', () => {
    // Aplicamos la evidencia como en test 2
    graph.get('J')!.evidence = 'si';
    graph.get('M')!.evidence = 'si';
    
    recalcAllMarginals(graph);
    
    const pBurglaryS = graph.get('B')!.marginals.si;
    
    // Verificamos que cambie el resultado basado en evidencias
    expect(pBurglaryS).toBeGreaterThan(0);
    expect(pBurglaryS).toBeLessThan(1);

    // En la clásica red de Pearl P(Burglary=T | John=T, Mary=T) ≈ 0.284 (28.4%)
    expect(pBurglaryS).toBeCloseTo(0.284, 2);
  });
});
