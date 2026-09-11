# Model inference audit

## Decision

Phase 3 uses the final research specification: **Reduced XGBoost — log1p target (Method 2B)** with 18 semantic predictors. The authoritative notebook did not retain a serialized estimator, so the model was reproducibly refit from the exact notebook procedure and serialized for local inference. No model selection, tuning, feature changes, or 2024 optimization were performed.

## Provenance

- Authoritative notebook: `C:\Users\LORD OF LORDS\Desktop\UNBOXINGTHEBLACKBOX.ipynb`
- Relevant notebook cells: 150, 172, 174, 176, 178, and 184
- Source cohort: `C:\Users\LORD OF LORDS\Desktop\csv_hfl (1)\combined_five_states_with_location.csv`
- Development data: 960,182 eligible records from 2020–2023
- Temporal evaluation: 268,930 eligible records from 2024
- Reproduction script: `scripts/build_inference_artifacts.py`
- Serialized artifact: `model_artifacts/reduced_xgboost_method2b.joblib`
- Machine-readable audit: `model_artifacts/inference-audit.json`
- Known-prediction fixtures: `model_artifacts/inference-regression-fixtures.json`

## Exact feature schema

1. `bedroom_count`
2. `non_bedroom_rooms`
3. `lot_size_order`
4. `year_built_order`
5. `survey_year`
6. `signed_log_household_income_2024`
7. `household_size`
8. `year_moved_order`
9. `first_mortgage_log_2024`
10. `hoa_fee_log_2024`
11. `electricity_log_2024`
12. `gas_log_2024`
13. `other_fuel_log_2024`
14. `water_sewer_log_2024`
15. `structure_type`
16. `heating_fuel`
17. `state_puma`
18. `household_type`

## Exact preprocessing

- Property value target: `log1p(adjusted_property_value_2024)`, inverted with `expm1`.
- Household income: 2024-dollar adjustment, then signed `log1p`.
- Mortgage, HOA, electricity, gas, other fuel, and water/sewer: 2024-dollar adjustment and nonnegative `log1p`; the notebook's status-based structural-zero rules are reproduced during artifact construction.
- User-entered monetary values are explicitly described as 2024-equivalent dollars and therefore enter the same log transforms without another inflation adjustment.
- Year built is mapped to an observed ACS construction-era boundary: 1939, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2021, 2022, or 2023.
- Year moved is mapped to the 2024 ACS `YBL` periods.
- Numeric missing values: training-fold median with missingness indicator.
- Structure, heating fuel, and household type: most-frequent imputation then one-hot encoding with unknown categories ignored and minimum frequency 25.
- State–PUMA: five-fold cross-fitted `TargetEncoder`, continuous target, automatic smoothing, shuffled with random seed 42.

## Exact estimator

`XGBRegressor` parameters match notebook Method 2B:

- 600 estimators
- learning rate 0.02
- maximum depth 8
- minimum child weight 3
- subsample 0.70
- column sample by tree 0.60
- gamma 1
- alpha 0
- lambda 1
- objective `reg:absoluteerror`
- histogram tree method, maximum bin 256
- evaluation metric MAE
- random seed 42

The runtime versions are Python 3.12.4, pandas 2.2.2, NumPy 1.26.4, scikit-learn 1.7.2, XGBoost 2.1.3, and joblib 1.4.2.

## Numerical verification

The reproducible refit exactly matches the notebook's published 2024 metrics:

| Measure |        Notebook |           Refit | Difference |
| ------- | --------------: | --------------: | ---------: |
| Records |         268,930 |         268,930 |          0 |
| MAE     | $275,638.814768 | $275,638.814768 |          0 |
| RMSE    | $710,455.898589 | $710,455.898589 |          0 |
| R²      |    0.3176961239 |    0.3176961239 |          0 |

Eight retained inference fixtures match before and after serialization with maximum prediction difference 0. The automated suite verifies both native log output and `expm1` dollar output.

For every live estimate, exact XGBoost TreeSHAP is calculated from the loaded booster. Semantic contributions aggregate transformed columns back to the 18 model inputs. Additivity is checked as `expected value + sum(SHAP) ≈ native model output` with tolerance `5e-5`, consistent with the notebook's all-record maximum difference of `3.5e-5`.

## ZIP/ZCTA to model geography

The estimator was not trained on ZIP codes. `scripts/tab20_puma520_zcta520_natl.txt` is the official U.S. Census Bureau **2020 PUMA to 2020 ZCTA Relationship File** (SHA-256 `041fa1cb1a03b865bf121abae3d0c591c022876dc1272f9fe637b6ca00d91746`). The derived browser-safe lookup is `public/data/zip-puma-crosswalk.json`.

Allocation rule: treat the entered five-digit ZIP as a 2020 ZCTA; select the intersecting 2020 PUMA with the largest combined land-and-water intersection area. The response retains the winner's area share, number of intersecting PUMAs, and the three largest alternatives. Shares below 80% are displayed as ambiguous. A USPS ZIP without a Census ZCTA is not silently approximated.

Source: <https://www2.census.gov/geo/docs/maps-data/data/rel2020/puma520/tab20_puma520_zcta520_natl.txt>

## Runtime boundary

The model runs only in `inference/valuation_service.py` through FastAPI/Uvicorn, bound by default to `127.0.0.1:8765` locally and to Render's `PORT` on `0.0.0.0` in production. The browser never receives the serialized estimator or raw ACS microdata. `npm run dev` starts the web runtime and inference service together. The service stores no requests and returns `Cache-Control: no-store`.

Production loads `model_artifacts/puma-local-drivers.json`, a deterministic lossless projection of the five State-PUMA SHAP presentation files containing only the local-driver rows used by `/predict`. Scenario recommendations use prediction-only inference; the primary explanation still calculates exact TreeSHAP and verifies additivity. Regression tests prove the transport and optimization do not change prediction, log prediction, geography, context, scenarios, or SHAP outputs.

The compact production runtime artifacts total 9.39 MiB, reduced from 12.73 MiB. A one-worker, one-thread local production-service load test measured a 2.08-second cold start and 295.38 MiB peak RSS. Batches of 1, 2, 5, and 10 simultaneous complete predictions produced zero errors; observed p95 latencies were 73, 150, 356, and 732 milliseconds. These are development-machine measurements, not guarantees of Render latency. The recorded result is `model_artifacts/load-test-results.json`.

## Scientific limits

- The target is respondent-reported ACS property value, not an appraisal or sale price.
- The five-state model must not predict outside California, Florida, New York, Tennessee, or Texas.
- ZCTA-to-PUMA resolution is an area allocation and may be ambiguous.
- Local context bands are survey-weighted observed 2024 value quantiles, not confidence or prediction intervals.
- SHAP explains model output in log1p units; it is not a dollar-causal effect.
- Scenario results are counterfactual model predictions with other entered inputs held fixed. They do not estimate feasibility, construction cost, return on investment, or market appreciation.
