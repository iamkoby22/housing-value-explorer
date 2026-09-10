# Housing Value Explorer

Public research-results explorer for _Unboxing the Black Box: Geographic Variation in Machine-Learning Explanations of U.S. Housing Values_.

## Local development

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vinext.

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
