# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — dev server at http://localhost:4200 (`ng serve`).
- `npm run build` — prod build into `dist/risk/browser` (+ SSR `dist/risk/server`).
- `npm run watch` — dev build, watch mode.
- `npm test` — Vitest unit tests via `ng test`. Single spec: `npx vitest run src/daga/utils/<file>.spec.ts`.
- `npm run lint` — angular-eslint + typescript-eslint + prettier rules.
- `npm run format` / `format:check` — Prettier write/check.
- `npm run cy:open` / `cy:run` — Cypress (project root `e2e/`, baseUrl `http://localhost:4200`). Dev server must be running.
- `npm run serve:ssr:risk` — run SSR server bundle from `dist/`.
- Deploy: `scripts/publish-pre.sh` (pre-risk.metadev.pro) and `scripts/publish-pro.sh` (risk.metadev.pro). Both `npm run build` then sync to S3 (region eu-south-2) via `deploy-to-s3.sh` + apply CORS JSON. Require AWS CLI creds.

## Architecture

Angular 21 standalone-component SPA (SSR-enabled) wrapping the `@metadev/daga` / `@metadev/daga-angular` diagram engine to model probability graphs. Three diagram modes share one canvas abstraction.

### Bootstrap & shell

- `src/main.ts` bootstraps `SimpleComponent` (`src/daga/component/prob.component.ts`) with `simpleAppConfig` (`prob.app.config.ts`, only `provideBrowserGlobalErrorListeners`).
- `SimpleComponent` is shell: sidebar + `selectedModel: 'binomial' | 'pathProbability' | 'bayes'` switches between three feature components. Template `dagaIndex.html`.
- SSR entrypoints: `main.server.ts`, `server.ts` (Express).

### DagaBaseComponent (the core)

`src/daga/component/dagaBase.component.ts` is shared engine logic for all three modes. Key contract:

- Inputs: `autoNormalizeAdjacent`, `showTheoreticalProbabilities`, `branchValueKey` (default `'probability'`, switched to weight key in binomial), `bayesMode`, `bayesGraph`.
- Subscribes to `canvas.diagramChange$` and dispatches on `UpdateValuesAction` / `AddConnectionAction` / `RemoveAction`.
- Probability key + max stored as `PROBABILITY_KEY` / `MAX_PROBABILITY` (0–100 scale, see commit `4021dd7`). All edits flow through `normalizeProbability` in `utils/probability.utils.ts`.
- Sibling-rebalance logic lives in `utils/connectionCalculate.utils.ts` (`handleConnectionStructuralChange`, `handleConnectionUpdateValues`, `AUTO_NORMALIZE_ADJACENT_KEY`). Re-entry guarded by `isApplyingConnectionRebalance`.
- Decorators: SVG/foreignObject overlays drawn via `canvas.model.decorators.new(...)`. Three suffixes: `-probability-decorator`, `-theoretical-probability-decorator`, `-bayes-decorator`. Always remove-then-redraw on every diagram change (`refreshProbabilityDecorators`).
- Bayes mode uses DOM `dblclick` listener on `daga-diagram` element + `data-node-id` walk-up to emit `nodeDoubleClicked`; `handleUpdateValuesAction` is no-op when `bayesMode=true`.
- Validator `DagaBaseDiagramValidator` errors when model has zero nodes.

Node id normalization (`utils/generalCalculationNodes.utils.ts` → `normalizeNodeId`) is required because `@metadev/daga` may suffix ids; always normalize before keying maps/emitting.

### Three modes

Each has component + config + utils:

- **Binomial** — `binomial.component.ts`, weight-based branching. Theoretical probabilities computed via `binomialWeight.utils.ts::calculateTheoreticalNodeProbabilities`. Per-connection nodes in `binomialCalculationNodes.utils.ts`. `branchValueKey` switches off `'probability'` so connection labels show raw weights.
- **Path probability** — `pathProbability.component.ts`, config `config/pathProbability.config.ts`, calc in `pathProbabilityCalculationNodes.utils.ts`. Returns `pathProbabilityPathResult[]` per `(start,end)` pair (see `types.d.ts`).
- **Bayes** — `bayes.component.ts`, config `bayes.config.ts`. Inference engine in `utils/bayes/bayesInference.utils.ts`; supporting modules: `causalLayout.ts`, `csv.utils.ts`, `em.utils.ts`, `mle.utils.ts`, `montecarlo.utils.ts`, `structureLearning.utils.ts`, `syntheticData.utils.ts`. Bayes graph passed to `DagaBaseComponent` via `[bayesGraph]` Input; node marginals (`si`/`no`) + `evidence` rendered as inline foreignObject bars.

### Generic component

`generic.component.ts` is the abstract pattern host for the three feature components — they extend it and pass mode-specific config to the daga canvas.

## Conventions

- Keep probability scale 0–100 everywhere; convert at I/O boundary only. Never re-introduce 0–1 scale without updating `MAX_PROBABILITY`.
- Always go through `normalizeProbability` / `normalizeWeightValue` before writing to a `valueSet`.
- After any structural change to connections, refresh decorators AND `connectionSourceByConnectionId` map (used to recover source nodes for `RemoveAction`).
- Cypress specs use `data-cy` test IDs (see commit `6023960`). New interactive UI must expose stable `data-cy`.
- Prettier + eslint-config-prettier active — run `npm run format` before commits.
