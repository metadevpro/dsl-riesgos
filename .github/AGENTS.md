# AGENTS Guide

## 1. Scope

This file is mandatory living documentation for architecture flow, coding standards, and authorized behavior changes in this repository.

## 2. Engineering Standards

### 2.1 Code Quality and Linting

- Use linters and formatters (for example ESLint and Prettier) to maintain consistent style.
- Fix lint errors and type errors before merging.
- Prefer minimal, focused edits that preserve existing behavior unless a behavior change is explicitly requested.

### 2.2 Documentation

- Update documentation (including this file) whenever features, APIs, workflows, or responsibilities change.
- Document public functions, components, and modules.

### 2.3 Security and Secrets

- Never commit secrets, tokens, credentials, or sensitive data.
- Use environment variables or secret management for credentials.

### 2.4 General Best Practices

- Keep code clear, concise, and self-explanatory.
- Prefer small focused commits and pull requests.
- Keep dependencies current and remove unused code.

### 2.5 Testing

- Write unit tests (`.spec.ts`) for utility functions and core components to ensure mathematical and logic accuracy.

## 3. Project Context (DAGA Tutorial)

### 3.1 Objective

- The app builds and simulates DAGA probability diagrams.
- Users create nodes and connections, execute calculations, and inspect result history.

### 3.2 Quick Start for Agents

- Bootstrap entry is `src/main.ts`, which mounts `SimpleComponent` from `src/daga/component/prob.component.ts`.
- The shell template is `src/daga/dagaIndex.html`.
- Model switch currently supports `binomial`, `pathProbability`, and `bayes`.
- Shared UI state and base flows live in `src/daga/component/generic.component.ts`.
- Canvas lifecycle and decorators are handled by `src/daga/component/dagaExample.component.ts`.
- Reusable graph/probability logic must stay in `src/daga/utils` and not be duplicated inside components.

### 3.3 Runtime Entry Points

- `src/main.ts`: starts the app with `simpleAppConfig`.
- `src/daga/prob.app.config.ts`: registers global browser error listeners.
- `src/daga/component/prob.component.ts`: shell component with sidebar and model mounting.

### 3.4 Main Functional Modules

- `src/daga/component/prob.component.ts` (`SimpleComponent`): host shell and model selection.
- `src/daga/component/generic.component.ts` (`GenericComponent`): shared dialogs, results bar, node stats, and base helpers.
- `src/daga/component/binomial.component.ts` (`BinomialComponent`): binomial calculation trigger and result flow.
- `src/daga/component/pathProbability.component.ts` (`pathProbabilityComponent`): path posterior calculation and specialized rendering.
- `src/daga/component/bayes.component.ts` (`BayesComponent`): Bayes model orchestration with live inference, evidence/CPT popup editing, marginal sync to node data, Monte Carlo simulation, and CSV-based learning (MLE/EM).
- `src/daga/component/dagaExample.component.ts` (`ExampleComponent`): DAGA canvas integration, validation, connection update handling, and decorators.
- `src/daga/dagaIndex.html`: sidebar + dynamic model workspace.
- `src/daga/binomial.html`, `src/daga/pathProbability.html`, `src/daga/bayes.html`: per-model workspaces.

### 3.5 Config Sources

- `src/daga/config/prob.config.ts`: binomial diagram schema (includes start, transition, node, end types and weight-based connection fields).
- `src/daga/config/pathProbability.config.ts`: pathProbability diagram schema.
- `src/daga/config/bayes.config.ts`: Bayes diagram schema, Bayes data fields (`bayes_evidence`, `bayes_cpt`, `bayes_pSi`, `bayes_pNo`), and visual tuning.

### 3.6 Utility Modules and Canonical Responsibilities

- `src/daga/utils/generalCalculationNodes.utils.ts`: node ID normalization, endpoint extraction, start/end discovery, and graph helpers.
- `src/daga/utils/probability.utils.ts`: canonical probability normalization and formatting (`PROBABILITY_KEY`, `MAX_PROBABILITY`).
- `src/daga/utils/connectionCalculate.utils.ts`: probability-mode connection update and sibling rebalancing utilities.
- `src/daga/utils/binomialCalculationNodes.utils.ts`: Monte Carlo binomial simulation engine.
- `src/daga/utils/binomialWeight.utils.ts`: raw weight normalization and theoretical node probability propagation.
- `src/daga/utils/pathProbabilityCalculationNodes.utils.ts`: path-based posterior probability computation.
- `src/daga/utils/bayesInference.utils.ts`: Bayes graph model, CPT generation/recalculation, exact marginal inference, topological sort, and CPT table/validation helpers.
- `src/daga/utils/montecarlo.utils.ts`: Bayesian network Monte Carlo sampler (`ejecutarMonteCarlo`, `calcularError`, `marginalesExactos`).
- `src/daga/utils/csv.utils.ts`: CSV parsing, column-to-node mapping, and value normalization for learning (`parsearCSV`, `analizarCSV`, `normalizarValor`).
- `src/daga/utils/mle.utils.ts`: Maximum Likelihood Estimation with Laplace smoothing for fully-observed networks (`aprenderMLE`).
- `src/daga/utils/em.utils.ts`: Expectation-Maximization for networks with latent nodes (`aprenderEM`, `mStep`, `calcularDelta`, `inicializarUniforme`).
- `src/daga/utils/syntheticData.utils.ts`: synthetic CSV data generation from an existing network (`generarDatosSinteticos`).

### 3.7 Important Function Contracts

- `calculateBinomialProbability(...)`: single public entry for binomial simulation runs.
- `calculatepathProbabilityProbability(...)`: single public entry for path probability posterior calculations.
- `buildBayesGraph(...)`, `recalcAllMarginals(...)`, `calcMarginal(...)`: canonical Bayes inference and graph-projection functions.
- `getCPTTableRows(...)`, `validateCPT(...)`, `recalcCPTOnParentChange(...)`: canonical Bayes CPT editing/validation/migration helpers.
- `normalizeProbability(...)` and `formatProbabilityPercent(...)`: canonical conversion and display rules.
- `normalizeWeightValue(...)`: canonical parser for raw positive branch weights.
- `extractConnectionEndpoints(...)`, `normalizeNodeId(...)`, `findStartNode(...)`, `findEndNode(...)`: canonical graph identity and traversal helpers.
- `ejecutarMonteCarlo(graph, evidencias, nIteraciones)`: single entry for Bayes MC sampling; returns `MCResult`.
- `calcularError(teorico, empirico)`: computes absolute error between exact and empirical marginals.
- `parsearCSV(texto)`, `analizarCSV(graph, headers)`, `normalizarValor(valor, nodo)`: canonical CSV ingestion pipeline.
- `aprenderMLE(graph, datos, suavizado?)`: MLE learning; use when all nodes are observed in CSV.
- `aprenderEM(graph, datos, opciones?)`: EM learning; use when some nodes are latent.
- `generarDatosSinteticos(graph, nMuestras, nodosOcultar?)`: generates a training CSV from an existing network.

### 3.8 Current Behavioral Notes

- Binomial uses branch `weight` values for transition selection and shows theoretical decorators.
- PathProbability executes without iteration input and stores posterior/path data in result entries.
- Bayes uses live inference in-canvas: node double-click opens popup, evidence/CPT edits recalculate marginals immediately, and Bayes decorators render per node.
- Bayes toolbar (top-right) exposes three actions: **Monte Carlo** (sample-based inference with error vs exact), **Importar CSV** (MLE or EM learning flow with before/after CPT comparison), and **Generar CSV** (download synthetic training data from current network).
- Learning flow: `parsearCSV` → `analizarCSV` → if all nodes observed use `aprenderMLE`, else `aprenderEM` with progress callback → user accepts or discards updated CPTs.

## 4. End-to-End Functional Flow

1. User selects a model from the sidebar (`binomial`, `pathProbability`, or `bayes`).
2. Shell mounts exactly one model component at a time.
3. User edits diagram on DAGA canvas.
4. `ExampleComponent` reacts to `diagramChange$` events and applies validation/normalization/update flows.
5. Binomial and pathProbability use model-specific calculation paths (dialog-based), while Bayes uses node double-click popup interaction.
6. In Bayes mode, evidence/CPT edits trigger real-time marginal recomputation and decorator refresh.
7. Shared result flow updates history and opens results panel for models that use result history.
8. Switching model remounts a different component instance, isolating view state and config.

## 5. Rules to Avoid Duplication

- Do not reimplement probability parsing and formatting in components.
- Do not duplicate graph endpoint and traversal helper logic.
- Keep templates focused on binding and event wiring, not business logic.
- If logic is needed in two or more places, extract or reuse existing utils.

## 6. Clean Code Conventions for This Repo

- Apply defensive checks when reading canvas model collections.
- Preserve unrelated edited fields when overwriting value sets.
- Keep method responsibilities separated by layer:
  - Shared UI flow in `GenericComponent`
  - Model-specific orchestration in model components
  - Canvas lifecycle in `ExampleComponent`
  - Pure computations in `utils`
- Use early returns for validation and failure handling.
- Preserve existing constants and naming conventions unless explicitly refactoring them.

## 7. Safe Change Checklist for Agents

### 7.1 Before Editing

- Classify the change impact (UI, canvas behavior, simulation engine, architecture).
- Locate existing reusable helpers first.

### 7.2 During Editing

- Touch the smallest possible surface.
- Avoid creating parallel utilities with overlapping purposes.

### 7.3 After Editing

- Run verification commands when relevant (`npm run build`).
- Execute unit tests (`npm test`) before major check-ins to prevent regressions.
- Confirm critical user flows still work.
- Update this file when architecture, responsibilities, flows, or conventions changed.

## 8. AGENTS.md Maintenance Policy (Always-On)

- This file must stay synchronized with authorized changes.
- Any change affecting architecture, flow, responsibilities, or public behavior must update this file in the same task/PR.
- If a change has no documentation impact, explicitly state: `No AGENTS.md update required`.

### 8.1 Mandatory Update Triggers

- New, removed, or renamed components/modules/utilities/entry points.
- Logic moved across UI, canvas lifecycle, and utility layers.
- Probability, traversal, normalization, or result-rendering behavior changes.
- Deprecations, compatibility shims, or public API replacements.
- New anti-duplication rules or validation steps.

### 8.2 Required Update Checklist

1. Identify impact scope.
2. Update relevant sections in this file.
3. Keep wording concise and operational.
4. Verify paths and symbol names match repository state.
