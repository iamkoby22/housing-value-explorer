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
- FastAPI/Uvicorn Python/XGBoost inference service
- Static Vinext production export; no remote deployment yet

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
       inference/valuation_service.py (local 127.0.0.1:8765; hosted HTTPS API)
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

- `app/` — six canonical product routes plus the compatibility-only `/evaluate` route.
- `components/app-shell.tsx` — shared responsive shell and primary navigation.
- `components/analysis-workspace.tsx` — route-scoped Explore, Drivers, Model, and Diagnostics work surfaces.
- `components/` — editorial content, valuation workflow, and reusable visualization components.
- `lib/` — typed data schemas, loaders, labels, and formatting.
- `scripts/` — deterministic research export and source audit.
- `public/data/` — generated, browser-safe scientific results.
- `tests/` — data and route consistency checks.

## Routing

- `/` — Overview
- `/explore` — Housing EDA, geography, and comparison workspace
- `/estimate` — progressive home profile, exact model estimate, local SHAP, support diagnostics, local context, and scenario lab
- `/drivers` — global, state, approximate-county, and State-PUMA SHAP exploration and dependence
- `/model` — model comparison, CV folds, temporal performance, and diagnostics
- `/research` — scientific documentation and limitations
- `/evaluate` — backward-compatible redirect to the appropriate canonical module while preserving query state

## Runtime and deployment

Local development remains one command: `npm run dev` starts Vinext and the FastAPI/Uvicorn inference service together. The browser normally uses `http://localhost:3001` and inference defaults to `http://127.0.0.1:8765`.

Production is prepared as two Render services: a static `dist/client` frontend and one Python `1c-2g` web service. The browser API origin is compiled from `NEXT_PUBLIC_INFERENCE_API_URL`; the API uses explicit `HOUSING_ALLOWED_ORIGINS`, Render's `PORT`, `0.0.0.0`, one Uvicorn worker, and one numerical thread. Runtime inference loads only the 3.82 MiB serialized model, ZIP-PUMA lookup, valuation context, and deterministic compact PUMA driver lookup. No remote deployment has been performed.

## Five-phase roadmap

1. Research grounding, deterministic data layer, design system, polished Overview, and foundational routes.
2. Deep geographic explorer with housing context, PUMA/county layers, comparison, linked URL state, and reliability UX. **Implemented locally.**
3. Individual home valuation, exact local SHAP, support diagnostics, and scenario intelligence. **Implemented locally.**
4. Unified application shell and experience consolidation. **Implemented locally.**
5. Integration, accessibility, performance, responsive refinement, and release hardening.

Scientific analysis changes remain outside the web application and require explicit authorization plus corresponding notebook changes.
