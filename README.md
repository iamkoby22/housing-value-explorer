# Housing Value Explorer

Public research-results explorer for _Unboxing the Black Box: Geographic Variation in Machine-Learning Explanations of U.S. Housing Values_.

## Local development

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vinext.

The single development command starts the React application and the local-only Python inference service together. There is no database. The web preview normally opens at `http://localhost:3001` when port 3000 is occupied; the inference service binds only to `http://127.0.0.1:8765`.

The public research presentation begins at `/`. The Phase 2 analytical workspace is at `/evaluate`. The Phase 3 homeowner valuation workspace is at `/estimate`. All phases are intentionally local-only and have not been remotely deployed.

Set `HOUSING_EXPLORER_PYTHON` if the appropriate Python interpreter is not discoverable automatically. The pinned dependencies are recorded in `requirements.txt`.

## Rebuild the locked inference artifact

This is only needed when reproducing the checked-in model artifact from the authoritative workstation data:

```powershell
python -m pip install -r requirements.txt
npm run build:inference
```

The command reproduces—not retunes—the exact selected Method 2B estimator and verifies its 2024 metrics against the notebook. See `MODEL_INFERENCE_AUDIT.md`.

## Research-data export

The checked-in `public/data` artifacts are generated from the authoritative research outputs. From the repository root on the research workstation:

```powershell
python -m pip install -r requirements.txt
python scripts/export_research_data.py `
  --notebook "C:\Users\LORD OF LORDS\Desktop\UNBOXINGTHEBLACKBOX.ipynb" `
  --workbook "C:\Users\LORD OF LORDS\Desktop\geographic_shap_analysis.xlsx" `
  --publication-dir "C:\Users\LORD OF LORDS\Desktop\csv_hfl (1)\capstone_figures\publication_readiness" `
  --figures-dir "C:\Users\LORD OF LORDS\Desktop\csv_hfl (1)\capstone_figures" `
  --county-shapefile "C:\Users\LORD OF LORDS\Desktop\csv_hfl (1)\boundaries\Counties\cb_2020_us_county_500k.shp" `
  --output public/data
```

The exporter only normalizes completed outputs. It does not read raw PUMS microdata or train a model.

## Quality checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Read `RESEARCH_SPEC.md`, `DESIGN.md`, `ARCHITECTURE.md`, and `AGENTS.md` before changing scientific content or interaction patterns.
