"""Reproduce and serialize the notebook's selected Method 2B estimator.

This script is intentionally a productization step, not a new modeling run. It
uses the exact feature construction, 2020-2023 development cohort,
preprocessing, XGBoost parameters, and seeds recorded in
UNBOXINGTHEBLACKBOX.ipynb.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, TargetEncoder
from xgboost import XGBRegressor


FEATURES = [
    "bedroom_count",
    "non_bedroom_rooms",
    "lot_size_order",
    "year_built_order",
    "survey_year",
    "signed_log_household_income_2024",
    "household_size",
    "year_moved_order",
    "first_mortgage_log_2024",
    "hoa_fee_log_2024",
    "electricity_log_2024",
    "gas_log_2024",
    "other_fuel_log_2024",
    "water_sewer_log_2024",
    "structure_type",
    "heating_fuel",
    "state_puma",
    "household_type",
]

NUMERIC_FEATURES = [
    "bedroom_count",
    "non_bedroom_rooms",
    "lot_size_order",
    "year_built_order",
    "survey_year",
    "signed_log_household_income_2024",
    "household_size",
    "year_moved_order",
    "first_mortgage_log_2024",
    "hoa_fee_log_2024",
    "electricity_log_2024",
    "gas_log_2024",
    "other_fuel_log_2024",
    "water_sewer_log_2024",
]

CATEGORICAL_FEATURES = [
    "structure_type",
    "heating_fuel",
    "state_puma",
    "household_type",
]

SOURCE_COLUMNS = [
    "housing_unit_serial_number",
    "housing_tenure",
    "housing_or_group_quarters_unit_type",
    "units_in_structure",
    "estimated_property_value",
    "housing_dollar_adjustment_factor",
    "income_dollar_adjustment_factor",
    "bedroom_count",
    "room_count",
    "state_fips_code",
    "puma_code",
    "housing_unit_weight",
    "household_income",
    "person_count_in_household",
    "year_moved_into_unit",
    "household_type",
    "lot_size",
    "year_structure_built",
    "house_heating_fuel",
    "monthly_first_mortgage_payment",
    "monthly_hoa_or_condo_fee",
    "monthly_electricity_cost",
    "monthly_gas_cost",
    "annual_other_fuel_cost",
    "annual_water_and_sewer_cost",
    "first_mortgage_status",
    "electricity_cost_status",
    "gas_cost_status",
    "other_fuel_cost_status",
    "water_and_sewer_cost_status",
    "state_name",
    "county_geoid",
    "county_full_name",
    "puma_county_overlap_percent",
]

XGB_PARAMS = {
    "n_estimators": 600,
    "learning_rate": 0.02,
    "max_depth": 8,
    "min_child_weight": 3,
    "subsample": 0.70,
    "colsample_bytree": 0.60,
    "gamma": 1,
    "reg_alpha": 0,
    "reg_lambda": 1,
    "objective": "reg:absoluteerror",
}

EXPECTED_2024 = {
    "mae": 275638.81476808304,
    "rmse": 710455.8985894376,
    "r_squared": 0.3176961238651559,
    "records": 268930,
}

SUPPORTED_STATES = {
    "06": "California",
    "12": "Florida",
    "36": "New York",
    "47": "Tennessee",
    "48": "Texas",
}


def make_model() -> TransformedTargetRegressor:
    preprocessor = ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        (
                            "imputation",
                            SimpleImputer(strategy="median", add_indicator=True),
                        )
                    ]
                ),
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputation", SimpleImputer(strategy="most_frequent")),
                        (
                            "one_hot",
                            OneHotEncoder(
                                handle_unknown="ignore",
                                min_frequency=25,
                                sparse_output=True,
                            ),
                        ),
                    ]
                ),
                ["structure_type", "heating_fuel", "household_type"],
            ),
            (
                "state_puma_target_encoding",
                Pipeline(
                    [
                        (
                            "target_encoding",
                            TargetEncoder(
                                target_type="continuous",
                                smooth="auto",
                                cv=5,
                                shuffle=True,
                                random_state=42,
                            ),
                        )
                    ]
                ),
                ["state_puma"],
            ),
        ],
        remainder="drop",
        sparse_threshold=1.0,
    )
    pipeline = Pipeline(
        [
            ("preprocessing", preprocessor),
            (
                "regression",
                XGBRegressor(
                    tree_method="hist",
                    eval_metric="mae",
                    max_bin=256,
                    n_jobs=16,
                    random_state=42,
                    verbosity=0,
                    **XGB_PARAMS,
                ),
            ),
        ]
    )
    return TransformedTargetRegressor(
        regressor=pipeline,
        func=np.log1p,
        inverse_func=np.expm1,
        check_inverse=False,
    )


def number(frame: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(frame[column], errors="coerce")


def load_cohort(source: Path) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.DataFrame]:
    raw = pd.read_csv(
        source,
        usecols=SOURCE_COLUMNS,
        dtype={
            "housing_unit_serial_number": "string",
            "state_fips_code": "string",
            "puma_code": "string",
        },
        low_memory=False,
        memory_map=True,
    )

    target = number(raw, "estimated_property_value") * number(
        raw, "housing_dollar_adjustment_factor"
    ) / 1_000_000
    cohort_mask = (
        number(raw, "housing_tenure").isin([1, 2])
        & number(raw, "housing_or_group_quarters_unit_type").eq(1)
        & number(raw, "units_in_structure").isin([2, 3])
        & target.gt(0)
    )
    raw = raw.loc[cohort_mask].copy()
    target = target.loc[cohort_mask].astype(float)

    survey_year = pd.to_numeric(
        raw["housing_unit_serial_number"].str[:4], errors="raise"
    ).astype(int)
    state_code = raw["state_fips_code"].str.replace(r"\.0$", "", regex=True).str.zfill(2)
    puma_code = raw["puma_code"].str.replace(r"\.0$", "", regex=True).str.zfill(5)
    housing_factor = number(raw, "housing_dollar_adjustment_factor") / 1_000_000
    income_factor = number(raw, "income_dollar_adjustment_factor") / 1_000_000

    features = pd.DataFrame(index=raw.index)
    features["bedroom_count"] = number(raw, "bedroom_count")
    features["non_bedroom_rooms"] = (
        number(raw, "room_count") - features["bedroom_count"]
    ).clip(lower=0)
    features["lot_size_order"] = number(raw, "lot_size")
    features["year_built_order"] = number(raw, "year_structure_built")
    features["survey_year"] = survey_year.astype(float)
    adjusted_income = number(raw, "household_income") * income_factor
    features["signed_log_household_income_2024"] = np.sign(adjusted_income) * np.log1p(
        np.abs(adjusted_income)
    )
    features["household_size"] = number(raw, "person_count_in_household")
    features["year_moved_order"] = number(raw, "year_moved_into_unit")

    adjusted_costs = {
        "first_mortgage_log_2024": number(raw, "monthly_first_mortgage_payment")
        * housing_factor,
        "hoa_fee_log_2024": number(raw, "monthly_hoa_or_condo_fee") * housing_factor,
        "electricity_log_2024": number(raw, "monthly_electricity_cost")
        * housing_factor,
        "gas_log_2024": number(raw, "monthly_gas_cost") * housing_factor,
        "other_fuel_log_2024": number(raw, "annual_other_fuel_cost") * housing_factor,
        "water_sewer_log_2024": number(raw, "annual_water_and_sewer_cost")
        * housing_factor,
    }
    zero_rules = {
        "first_mortgage_log_2024": number(raw, "first_mortgage_status").eq(3),
        "electricity_log_2024": number(raw, "electricity_cost_status").eq(2),
        "gas_log_2024": number(raw, "gas_cost_status").eq(3),
        "other_fuel_log_2024": number(raw, "other_fuel_cost_status").eq(2),
        "water_sewer_log_2024": number(raw, "water_and_sewer_cost_status").eq(2),
    }
    for feature, values in adjusted_costs.items():
        rule = zero_rules.get(feature)
        if rule is not None:
            values = values.mask(rule & values.isna(), 0.0)
        features[feature] = np.log1p(values)

    features["structure_type"] = (
        number(raw, "units_in_structure")
        .astype("Int64")
        .astype("string")
        .fillna("MISSING")
        .astype(object)
    )
    features["heating_fuel"] = (
        number(raw, "house_heating_fuel")
        .astype("Int64")
        .astype("string")
        .fillna("MISSING")
        .astype(object)
    )
    features["state_puma"] = (state_code + "_" + puma_code).fillna("MISSING").astype(object)
    features["household_type"] = (
        number(raw, "household_type")
        .astype("Int64")
        .astype("string")
        .fillna("MISSING")
        .astype(object)
    )

    metadata = pd.DataFrame(
        {
            "state_name": raw["state_name"].astype("string"),
            "state_puma": features["state_puma"].astype("string"),
            "survey_year": survey_year,
            "weight": number(raw, "housing_unit_weight"),
            "county_id": number(raw, "county_geoid").astype("Int64").astype("string").str.zfill(5),
            "county_label": raw["county_full_name"].astype("string"),
            "county_overlap": number(raw, "puma_county_overlap_percent"),
        },
        index=raw.index,
    )
    return features[FEATURES], target, metadata, raw


def weighted_quantiles(values: np.ndarray, weights: np.ndarray) -> dict[str, float]:
    order = np.argsort(values)
    values = values[order]
    weights = weights[order]
    cumulative = np.cumsum(weights) / weights.sum()
    return {
        f"p{int(q * 100):02d}": float(np.interp(q, cumulative, values))
        for q in [0.10, 0.25, 0.50, 0.75, 0.90]
    }


def support_summary(frame: pd.DataFrame) -> dict[str, object]:
    result: dict[str, object] = {}
    for feature in NUMERIC_FEATURES:
        values = pd.to_numeric(frame[feature], errors="coerce").dropna().to_numpy(float)
        result[feature] = {
            "records": int(len(values)),
            "minimum": float(np.min(values)),
            "p01": float(np.quantile(values, 0.01)),
            "p05": float(np.quantile(values, 0.05)),
            "median": float(np.quantile(values, 0.50)),
            "p95": float(np.quantile(values, 0.95)),
            "p99": float(np.quantile(values, 0.99)),
            "maximum": float(np.max(values)),
        }
    for feature in CATEGORICAL_FEATURES:
        counts = frame[feature].astype("string").value_counts(dropna=False)
        result[feature] = {
            "categories": [str(item) for item in counts.index.tolist()],
            "counts": {str(key): int(value) for key, value in counts.items()},
        }
    return result


def build_context(
    features: pd.DataFrame,
    target: pd.Series,
    metadata: pd.DataFrame,
) -> dict[str, object]:
    temporal = metadata["survey_year"].eq(2024)
    context = pd.DataFrame(
        {
            "state_name": metadata.loc[temporal, "state_name"].astype(str),
            "state_puma": metadata.loc[temporal, "state_puma"].astype(str),
            "target": target.loc[temporal].to_numpy(float),
            "weight": metadata.loc[temporal, "weight"].to_numpy(float),
            "county_id": metadata.loc[temporal, "county_id"].astype(str),
            "county_label": metadata.loc[temporal, "county_label"].astype(str),
            "county_overlap": metadata.loc[temporal, "county_overlap"].to_numpy(float),
        }
    )

    def summarize(group: pd.DataFrame) -> dict[str, object]:
        values = group["target"].to_numpy(float)
        weights = group["weight"].to_numpy(float)
        return {
            "records": int(len(group)),
            "survey_weight_sum": float(weights.sum()),
            **weighted_quantiles(values, weights),
        }

    state_puma = {}
    for key, group in context.groupby("state_puma", sort=True):
        county = (
            group.groupby(["county_id", "county_label"], dropna=False)
            .agg(records=("target", "size"), median_overlap=("county_overlap", "median"))
            .reset_index()
            .sort_values(["records", "median_overlap"], ascending=False)
            .iloc[0]
        )
        state_puma[key] = {
            **summarize(group),
            "state_name": str(group["state_name"].iloc[0]),
            "approximate_county_id": str(county["county_id"]).zfill(5),
            "approximate_county_label": str(county["county_label"]),
            "county_overlap_percent": float(county["median_overlap"]),
        }

    states = {
        key: {**summarize(group), "state_name": str(key)}
        for key, group in context.groupby("state_name", sort=True)
    }
    development = metadata["survey_year"].le(2023)
    return {
        "metadata": {
            "source": "2024 ACS PUMS temporal evaluation cohort",
            "weighting": "Housing-unit survey-weighted quantiles",
            "not_a_confidence_interval": True,
        },
        "study": summarize(context),
        "states": states,
        "state_pumas": state_puma,
        "development_support": support_summary(features.loc[development]),
        "year_built_categories": sorted(
            int(value)
            for value in features.loc[development, "year_built_order"].dropna().unique()
        ),
    }


def build_zip_crosswalk(source: Path, observed_pumas: set[str]) -> dict[str, object]:
    relationships = pd.read_csv(
        source,
        sep="|",
        dtype=str,
        usecols=[
            "GEOID_PUMA5_20",
            "NAMELSAD_PUMA5_20",
            "GEOID_ZCTA5_20",
            "AREALAND_PART",
            "AREAWATER_PART",
        ],
    ).dropna(subset=["GEOID_ZCTA5_20"])
    relationships["area"] = pd.to_numeric(
        relationships["AREALAND_PART"], errors="coerce"
    ).fillna(0) + pd.to_numeric(relationships["AREAWATER_PART"], errors="coerce").fillna(0)
    relationships["total_zcta_area"] = relationships.groupby("GEOID_ZCTA5_20")["area"].transform("sum")
    relationships = relationships.dropna(subset=["GEOID_PUMA5_20"])
    relationships["puma_geoid"] = relationships["GEOID_PUMA5_20"].str.zfill(7)
    relationships["state_puma"] = (
        relationships["puma_geoid"].str[:2] + "_" + relationships["puma_geoid"].str[2:]
    )
    relationships = relationships.sort_values(
        ["GEOID_ZCTA5_20", "area", "state_puma"], ascending=[True, False, True]
    )

    mapping = {}
    for zcta, group in relationships.groupby("GEOID_ZCTA5_20", sort=True):
        winner = group.iloc[0]
        state_fips = str(winner["puma_geoid"])[:2]
        if state_fips not in SUPPORTED_STATES:
            continue
        total = float(winner["total_zcta_area"])
        winner_share = float(winner["area"] / total) if total else 0.0
        alternatives = []
        for _, row in group.head(3).iterrows():
            alternatives.append(
                {
                    "state_puma": str(row["state_puma"]),
                    "puma_name": str(row["NAMELSAD_PUMA5_20"]),
                    "area_share": round(float(row["area"] / total) if total else 0.0, 6),
                }
            )
        mapping[str(zcta).zfill(5)] = {
            "state_fips": state_fips,
            "state_name": SUPPORTED_STATES[state_fips],
            "state_puma": str(winner["state_puma"]),
            "puma_name": str(winner["NAMELSAD_PUMA5_20"]),
            "allocation_area_share": round(winner_share, 6),
            "intersecting_pumas": int(len(group)),
            "ambiguous": winner_share < 0.80,
            "seen_in_model": str(winner["state_puma"]) in observed_pumas,
            "alternatives": alternatives,
        }
    return {
        "metadata": {
            "source": "U.S. Census Bureau 2020 PUMA to 2020 ZCTA Relationship File",
            "source_url": "https://www2.census.gov/geo/docs/maps-data/data/rel2020/puma520/tab20_puma520_zcta520_natl.txt",
            "vintage": 2020,
            "allocation_rule": "Largest combined land-and-water intersection area; shares use all intersecting PUMAs.",
            "zip_distinction": "User ZIP input is treated as a 2020 ZCTA lookup; USPS ZIPs without a ZCTA are unsupported.",
            "supported_states": list(SUPPORTED_STATES.values()),
        },
        "data": mapping,
    }


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        type=Path,
        default=Path(r"C:\Users\LORD OF LORDS\Desktop\csv_hfl (1)\combined_five_states_with_location.csv"),
    )
    parser.add_argument(
        "--crosswalk",
        type=Path,
        default=Path(__file__).with_name("tab20_puma520_zcta520_natl.txt"),
    )
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    print("Reading authoritative ACS cohort columns...")
    features, target, metadata, _raw = load_cohort(args.data)
    development = metadata["survey_year"].le(2023)
    temporal = metadata["survey_year"].eq(2024)
    print(f"Fitting exact Method 2B model on {int(development.sum()):,} development records...")
    model = make_model()
    model.fit(features.loc[development], target.loc[development])

    predictions = np.maximum(model.predict(features.loc[temporal]), 0)
    actual = target.loc[temporal].to_numpy(float)
    metrics = {
        "records": int(len(actual)),
        "mae": float(mean_absolute_error(actual, predictions)),
        "rmse": float(np.sqrt(mean_squared_error(actual, predictions))),
        "r_squared": float(r2_score(actual, predictions)),
    }
    differences = {
        key: metrics[key] - value for key, value in EXPECTED_2024.items() if key != "records"
    }
    if metrics["records"] != EXPECTED_2024["records"] or abs(differences["mae"]) > 1.0:
        raise RuntimeError(f"Reproduction did not match notebook metrics: {metrics}")

    development_features = features.loc[development]
    support = support_summary(development_features)
    artifact = {
        "model": model,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "xgb_params": XGB_PARAMS,
        "training_records": int(development.sum()),
        "training_years": [2020, 2021, 2022, 2023],
        "prediction_year": 2024,
        "support": support,
        "year_built_categories": sorted(
            int(value) for value in development_features["year_built_order"].dropna().unique()
        ),
        "observed_state_pumas": sorted(
            development_features["state_puma"].astype(str).unique().tolist()
        ),
    }
    artifact_path = args.root / "model_artifacts" / "reduced_xgboost_method2b.joblib"
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, artifact_path, compress=3, protocol=4)

    loaded = joblib.load(artifact_path)
    fixture_positions = np.linspace(0, int(temporal.sum()) - 1, 8, dtype=int)
    fixture_frame = features.loc[temporal].iloc[fixture_positions]
    before = model.predict(fixture_frame)
    after = loaded["model"].predict(fixture_frame)
    if not np.allclose(before, after, rtol=0, atol=1e-6):
        raise RuntimeError("Serialized estimator failed round-trip prediction equality.")

    fitted = loaded["model"].regressor_
    transformed = fitted.named_steps["preprocessing"].transform(fixture_frame)
    log_predictions = fitted.named_steps["regression"].predict(transformed)
    fixtures = []
    for position, (_, row), dollar, log_value in zip(
        fixture_positions, fixture_frame.iterrows(), after, log_predictions
    ):
        fixtures.append(
            {
                "temporal_position": int(position),
                "features": {
                    key: None if pd.isna(value) else (float(value) if key in NUMERIC_FEATURES else str(value))
                    for key, value in row.items()
                },
                "prediction_log1p": float(log_value),
                "prediction_dollars": float(dollar),
            }
        )

    context = build_context(features, target, metadata)
    crosswalk = build_zip_crosswalk(
        args.crosswalk, set(artifact["observed_state_pumas"])
    )
    atomic_json(args.root / "public" / "data" / "valuation-context.json", context)
    atomic_json(args.root / "public" / "data" / "zip-puma-crosswalk.json", crosswalk)
    atomic_json(
        args.root / "model_artifacts" / "inference-regression-fixtures.json",
        {"metadata": {"tolerance": 1e-6}, "data": fixtures},
    )
    crosswalk_hash = hashlib.sha256(args.crosswalk.read_bytes()).hexdigest()
    audit = {
        "model": "Reduced XGBoost - Log1p target (Method 2B)",
        "source": "UNBOXINGTHEBLACKBOX.ipynb cells 150, 172, 174, 176, 178, and 184",
        "artifact": str(artifact_path.relative_to(args.root)).replace("\\", "/"),
        "loaded_or_refit": "Reproducibly refit because no serialized estimator existed",
        "serialization": "joblib protocol 4, compression level 3",
        "features": FEATURES,
        "training_records": int(development.sum()),
        "temporal_records": int(temporal.sum()),
        "generated_2024_metrics": metrics,
        "notebook_2024_metrics": EXPECTED_2024,
        "metric_differences": differences,
        "serialization_max_prediction_difference": float(np.max(np.abs(before - after))),
        "crosswalk_sha256": crosswalk_hash,
        "crosswalk_records_supported": len(crosswalk["data"]),
    }
    atomic_json(args.root / "model_artifacts" / "inference-audit.json", audit)
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
