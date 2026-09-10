# Architecture

## Scope

This is a standalone research-results explorer and local homeowner valuation tool. It has no authentication, accounts, database, background workers, or dependency on VISION Office.

## Stack

- Next.js-compatible Vinext application
- React 19 and TypeScript
- Tailwind CSS
- Recharts for general statistical graphics
- D3 Geo for the five-state SVG geography selector
- Zod for runtime validation of curated research JSON
- Local Python/XGBoost inference service bound to loopback only
- Local Vinext development runtime; no remote Phase 3 deployment

One charting approach and one geographic renderer are used; no overlapping visualization frameworks are introduced.

## Data flow

```text
Authoritative notebook + geographic SHAP workbook + notebook-produced CSVs
                              ↓
             scripts/export_research_data.py
                              ↓
        validated, documented public/data/*.json
                              ↓
               server-side data access in lib/
                              ↓
         page and visualization React components
```

Raw ACS PUMS microdata is never shipped to the browser. The exporter normalizes existing outputs without retraining or changing the study methodology. It records source SHA-256 hashes, provenance, units, weighting, geographic level, and caveats.

Phase 3 adds a separate local inference path:

```text
Exact notebook Method 2B specification + 2020–2023 development cohort
                              ↓
           scripts/build_inference_artifacts.py
                              ↓
   model_artifacts/reduced_xgboost_method2b.joblib
                              ↓
       inference/valuation_service.py (127.0.0.1:8765)
                              ↓
               /estimate homeowner workspace
```

The productionized refit exactly reproduces the notebook's 2024 MAE, RMSE, and R². The service performs exact preprocessing, prediction, inverse `expm1`, semantic TreeSHAP aggregation, and per-request additivity checks. It neither stores requests nor exposes raw microdata.

## Curated datasets

- `study-summary.json` — scope and headline scientific facts.
- `feature-metadata.json` — the 18-feature human-readable registry.
- `model-performance.json` — five-fold CV uncertainty and 2024 temporal evaluation.
- `global-shap.json` — selected-model global importance.
- `state-shap.json` — state ranking and direction data.
- `county-shap.json` — descriptive approximate-county results with reliability.
- `puma-shap.json` — direct State-PUMA explanation results.
- `shap-dependence.json` — publication-readiness non-geographic dependence bins.
- `methodology.json` — workbook methods, leakage audit, limitations, and research questions.
- `housing-eda.json` — notebook-produced housing and target summaries for the analytical workspace.
- `model-diagnostics.json` — existing CV-fold, measurement-audit, and stability outputs.
- `states.geojson` — actual state geometry, generated from research boundary files when available.
- `county-geometry.geojson` — five-state county boundaries for descriptive approximate-county selection.
- `puma-geometry-*.geojson` and `puma-shap-*.json` — state-specific lazy-load payloads for the modeled geography.
- `source-manifest.json` — provenance and hashes.

## Application structure

- `app/` — the five public routes, the `/evaluate` workspace, and shared layout.
- `components/` — editorial shell and reusable visualization components.
- `lib/` — typed data schemas, loaders, labels, and formatting.
- `scripts/` — deterministic research export and source audit.
- `public/data/` — generated, browser-safe scientific results.
- `tests/` — data and route consistency checks.

## Routing

- `/` — Overview
- `/explore` — geography selector and state detail foundation
- `/drivers` — global importance and dependence
- `/model` — validation and temporal performance
- `/research` — scientific documentation and limitations
- `/evaluate` — Phase 2 analytical workspace with housing, geography, comparison, SHAP, model, diagnostics, and methodology modules
- `/estimate` — Phase 3 progressive home profile, model estimate, local SHAP, support diagnostics, local context, and session-only scenario lab

## Runtime and deployment

The default runtime is local: `npm run dev` starts Vinext and the Python inference service together. No database or database binding is required. The browser application is normally served at `http://localhost:3001`; model inference is loopback-only at `http://127.0.0.1:8765`. No Phase 2 or Phase 3 remote deployment was performed.

## Five-phase roadmap

1. Research grounding, deterministic data layer, design system, polished Overview, and foundational routes.
2. Deep geographic explorer with housing context, PUMA/county layers, comparison, linked URL state, and reliability UX. **Implemented locally.**
3. Individual home valuation, exact local SHAP, support diagnostics, and scenario intelligence. **Implemented locally.**
4. Model/publication layer with diagnostics, robust methodology, and downloadable supplements.
5. Integration, accessibility, performance, responsive refinement, and release hardening.

Scientific analysis changes remain outside the web application and require explicit authorization plus corresponding notebook changes.
