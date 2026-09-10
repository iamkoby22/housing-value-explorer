# Research specification

## Study

**Working title:** _Unboxing the Black Box: Geographic Variation in Machine-Learning Explanations of U.S. Housing Values_

This application presents an existing predictive study of owner-estimated housing values. It does not retrain the model or recompute the scientific analysis in the browser.

## Research questions and contribution

The primary question is how accurately 2024 inflation-adjusted property values for owner-occupied one-family houses in California, Florida, New York, Tennessee, and Texas can be predicted from 2020–2023 ACS PUMS property, household, financing, utility, and State-PUMA characteristics.

The geographic interpretation asks how the selected model's reliance on non-geographic predictors varies across states and dominant-overlap county summaries. The study contributes a leakage-safe comparison of linear, regularized, bagged-tree, gradient-boosting, and native-categorical models, followed by survey-weighted geographic TreeSHAP summaries.

## Data and cohort

- Source: U.S. Census Bureau American Community Survey Public Use Microdata Sample (ACS PUMS).
- Geography: California, Florida, New York, Tennessee, and Texas.
- Development period: 2020–2023, 960,182 eligible records.
- Temporal evaluation and explanation period: 2024, 268,930 eligible records.
- Cohort: owner-occupied one-family housing records used by the notebook's final modeling workflow.
- Survey weighting: housing-unit weights are used for descriptive and geographic SHAP aggregation.

## Target

The response is ACS PUMS `VALP`, the respondent's estimate of property value. Values are converted to comparable dollars as `VALP × ADJHSG / 1,000,000` where applicable. `VALP` is reported, rounded, allocated for some records, and state/year-specific top-coded. It is not an appraisal or transaction price.

## Selected model and validation

The selected model is reduced XGBoost with a `log1p` property-value target. It was selected using five-fold cross-validation on 2020–2023 data before the 2024 temporal evaluation. Feature reduction used development-fold evidence. The 2024 data were used only for final temporal evaluation and TreeSHAP interpretation.

The selected model's mean development CV MAE is $247,093 (95% interval $243,651–$250,535), mean RMSE is $655,008, and mean R² is 0.373. On 2024, its MAE is $275,639, median absolute error is $113,951, RMSE is $710,456, and R² is 0.318. These metrics show useful but incomplete predictive performance and must be presented together.

## Selected semantic features

The final specification contains 18 semantic features:

1. `bedroom_count` — BDSP; count.
2. `non_bedroom_rooms` — RMSP minus BDSP, clipped at zero; count.
3. `lot_size_order` — ACR; ordered category, one-hot encoded.
4. `year_built_order` — YRBLT; construction-era category, one-hot encoded.
5. `survey_year` — SERIALNO prefix; numeric year.
6. `signed_log_household_income_2024` — HINCP and ADJINC; signed `log1p` transformed income.
7. `household_size` — NP; count.
8. `year_moved_order` — YBL; ordered period, one-hot encoded.
9. `first_mortgage_log_2024` — MRGP and ADJHSG; `log1p`, with structural zero when no mortgage.
10. `hoa_fee_log_2024` — CONP and ADJHSG; `log1p`.
11. `electricity_log_2024` — ELEP and ADJHSG; `log1p`, with status-based structural zero.
12. `gas_log_2024` — GASP and ADJHSG; `log1p`, with status-based structural zero.
13. `other_fuel_log_2024` — FULP and ADJHSG; `log1p`, with status-based structural zero.
14. `water_sewer_log_2024` — WATP and ADJHSG; `log1p`, with status-based structural zero.
15. `structure_type` — BLD; nominal, one-hot encoded.
16. `heating_fuel` — HFL; nominal, one-hot encoded.
17. `state_puma` — STATE plus PUMA; five-fold cross-fitted target encoding.
18. `household_type` — HHT; nominal, one-hot encoded.

Remaining numeric missing values are handled with training-fold medians plus missingness indicators. Remaining categorical missing values are handled with training-fold most-frequent values before one-hot encoding. The State-PUMA encoder handles unseen geography within the leakage-safe pipeline.

## SHAP methodology

Exact TreeSHAP values from the selected model are available for all 268,930 2024 records. Importance is the survey-weighted mean absolute SHAP value. Direction is the survey-weighted mean signed SHAP value. Values are expressed in `log1p` property-value units, not dollars.

Global and geographic SHAP values describe the fitted model's predictions. They do not establish causal effects. Feature dependence is interpreted as modeled association, not as the expected result of intervening on a feature.

## Geographic levels

- **State:** aggregated from observed state identifiers.
- **State-PUMA:** the geography entered directly into the fitted model and the strongest audit level for geographic explanations.
- **Approximate county:** assigned after modeling from the largest PUMA–county boundary overlap. County results are descriptive approximations, not exact household county estimates.

Every county view must carry record count, effective sample size, median overlap, share of records with overlap at least 80%, and the workbook's reliability class. The observed county reliability classes are `Higher confidence`, `Moderate overlap`, and `Low sample`.

## Interpretation limits

- The analysis is predictive, not causal.
- The response is reported and top-coded, not an appraisal.
- Counties are approximate post-model summaries.
- Record-bootstrap stability is not an ACS successive-difference-replication margin of error.
- The geographic scope is five states and must not be generalized to the entire United States without external validation.
- Validation addresses short-horizon temporal generalization to 2024.
- Mortgage variables combine financing and underlying property/borrower context.
- Ordered ACS categories are not interval measurements.

## Authoritative sources

- `C:\Users\LORD OF LORDS\Desktop\UNBOXINGTHEBLACKBOX.ipynb`
- `C:\Users\LORD OF LORDS\Desktop\geographic_shap_analysis.xlsx`
- Existing notebook-produced publication-readiness CSVs under `C:\Users\LORD OF LORDS\Desktop\csv_hfl (1)\capstone_figures\publication_readiness`

The deterministic export script records file hashes and source paths in the generated manifest.
