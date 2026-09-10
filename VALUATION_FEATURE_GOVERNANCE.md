# Valuation feature governance

Recommendation eligibility is intentionally narrower than prediction or explanation eligibility. Every final predictor may be used by the fitted model and explained with SHAP. Only plausible property characteristics may be scenario-adjusted or surfaced as model-sensitivity opportunities.

| Feature                            | Class                                  | Display  | Explain | Scenario | Recommendation | Governance note                                                                    |
| ---------------------------------- | -------------------------------------- | :------: | :-----: | :------: | :------------: | ---------------------------------------------------------------------------------- |
| `bedroom_count`                    | Property characteristic                |   Yes    |   Yes   |   Yes    |      Yes       | A room-use/structure scenario only when physically feasible.                       |
| `non_bedroom_rooms`                | Property characteristic                |   Yes    |   Yes   |   Yes    |      Yes       | Represents room configuration; not proof that adding a room causes value.          |
| `lot_size_order`                   | Property characteristic                |   Yes    |   Yes   |    No    |       No       | Fixed parcel characteristic for this workflow.                                     |
| `year_built_order`                 | Fixed/historical                       |   Yes    |   Yes   |    No    |       No       | Original construction period cannot be changed.                                    |
| `survey_year`                      | Technical/model                        | Advanced |   Yes   |    No    |       No       | Fixed to 2024 for this productized temporal-estimation workflow.                   |
| `signed_log_household_income_2024` | Financial/household                    |   Yes    |   Yes   |    No    |       No       | Never framed as a home improvement.                                                |
| `household_size`                   | Household                              |   Yes    |   Yes   |    No    |       No       | Never used to advise demographic change.                                           |
| `year_moved_order`                 | Fixed/historical                       |   Yes    |   Yes   |    No    |       No       | Occupancy history, not a property intervention.                                    |
| `first_mortgage_log_2024`          | Financial                              |   Yes    |   Yes   |    No    |       No       | Financing signal is predictive and confounded with property/borrower context.      |
| `hoa_fee_log_2024`                 | Financial/property expense             |   Yes    |   Yes   |    No    |       No       | Not treated as a controllable improvement.                                         |
| `electricity_log_2024`             | Utility expense                        |   Yes    |   Yes   |    No    |       No       | Observed expense, not a guaranteed efficiency outcome.                             |
| `gas_log_2024`                     | Utility expense                        |   Yes    |   Yes   |    No    |       No       | Observed expense, not a guaranteed efficiency outcome.                             |
| `other_fuel_log_2024`              | Utility expense                        |   Yes    |   Yes   |    No    |       No       | Observed expense, not a guaranteed efficiency outcome.                             |
| `water_sewer_log_2024`             | Utility expense                        |   Yes    |   Yes   |    No    |       No       | Observed expense, not a guaranteed efficiency outcome.                             |
| `structure_type`                   | Fixed/property                         |   Yes    |   Yes   |    No    |       No       | Detached versus attached structure is not a routine homeowner modification.        |
| `heating_fuel`                     | Potentially modifiable property system |   Yes    |   Yes   |   Yes    |      Yes       | Scenario only; installation feasibility, costs, and code requirements are unknown. |
| `state_puma`                       | Geographic/context                     | Advanced |   Yes   |    No    |       No       | Inferred from ZCTA; never presented as something to manipulate.                    |
| `household_type`                   | Household                              |   Yes    |   Yes   |    No    |       No       | Never used for advice or optimization.                                             |

## Sensitive-feature audit

The selected 18 predictors do not include race, ethnicity, sex, disability, or other explicit protected-class fields. Household type, household size, income, mortgage, and geography may nevertheless encode socioeconomic or demographic patterns and can act as proxies. They remain prediction/explanation inputs because they are part of the locked research model, but they are excluded from scenario recommendations.

## Scenario policy

- Eligible: bedrooms, other rooms, heating fuel.
- Every scenario reruns the actual estimator.
- The interface states that changes describe model sensitivity with other inputs fixed.
- Inputs are constrained to trained categories and plausible numeric ranges.
- Scenarios outside observed development support are not recommended.
- No recommendation includes fabricated renovation cost, feasibility, ROI, sale-price guarantee, or causal language.
- A future cost field is permitted only as user-entered metadata; it must never silently alter the model prediction or be labeled as a validated cost estimate.
