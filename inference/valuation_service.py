"""Local-only HTTP inference service for the Phase 3 valuation workspace."""

from __future__ import annotations

import json
import math
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from xgboost import DMatrix


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_PATH = ROOT / "model_artifacts" / "reduced_xgboost_method2b.joblib"
CROSSWALK_PATH = ROOT / "public" / "data" / "zip-puma-crosswalk.json"
CONTEXT_PATH = ROOT / "public" / "data" / "valuation-context.json"

FEATURE_LABELS = {
    "bedroom_count": "Bedrooms",
    "non_bedroom_rooms": "Other rooms",
    "lot_size_order": "Lot size",
    "year_built_order": "Year built",
    "survey_year": "Prediction year",
    "signed_log_household_income_2024": "Household income",
    "household_size": "Household size",
    "year_moved_order": "Year moved in",
    "first_mortgage_log_2024": "First mortgage payment",
    "hoa_fee_log_2024": "Condo or HOA fee",
    "electricity_log_2024": "Electricity cost",
    "gas_log_2024": "Gas cost",
    "other_fuel_log_2024": "Other fuel cost",
    "water_sewer_log_2024": "Water and sewer cost",
    "structure_type": "Structure type",
    "heating_fuel": "Heating fuel",
    "state_puma": "Local model area",
    "household_type": "Household type",
}

STRUCTURE_VALUES = {"2", "3"}
HEATING_VALUES = {str(value) for value in range(1, 10)}
HEATING_LABELS = {
    "1": "Utility gas",
    "2": "Bottled, tank, or LP gas",
    "3": "Electricity",
    "4": "Fuel oil, kerosene, or similar",
    "5": "Coal or coke",
    "6": "Wood",
    "7": "Solar energy",
    "8": "Other fuel",
    "9": "No fuel used",
}
HOUSEHOLD_VALUES = {str(value) for value in range(1, 8)}
LOT_VALUES = {1, 2, 3}

NUMERIC_RULES = {
    "bedrooms": (0, 20),
    "other_rooms": (0, 30),
    "year_built": (1700, 2024),
    "household_income": (-1_000_000, 20_000_000),
    "household_size": (1, 30),
    "year_moved": (1900, 2024),
    "first_mortgage": (0, 200_000),
    "hoa_fee": (0, 100_000),
    "electricity": (0, 50_000),
    "gas": (0, 50_000),
    "other_fuel": (0, 500_000),
    "water_sewer": (0, 500_000),
    "user_estimated_cost": (0, 100_000_000),
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


if not ARTIFACT_PATH.exists():
    raise FileNotFoundError(
        f"Missing model artifact: {ARTIFACT_PATH}. Run scripts/build_inference_artifacts.py."
    )

ARTIFACT = joblib.load(ARTIFACT_PATH)
MODEL = ARTIFACT["model"]
FEATURES: list[str] = ARTIFACT["features"]
NUMERIC_FEATURES: set[str] = set(ARTIFACT["numeric_features"])
CROSSWALK = load_json(CROSSWALK_PATH)
CONTEXT = load_json(CONTEXT_PATH)


def load_local_drivers() -> dict[str, list[dict[str, Any]]]:
    result = {}
    for state_fips in ["06", "12", "36", "47", "48"]:
        payload = load_json(ROOT / "public" / "data" / f"puma-shap-{state_fips}.json")
        for row in payload["data"]:
            result[row["state_puma_id"]] = row["top_non_geographic_features"]
    return result


LOCAL_DRIVERS = load_local_drivers()


class InputError(ValueError):
    pass


def finite_optional(payload: dict[str, Any], key: str) -> float:
    value = payload.get(key)
    if value is None or value == "":
        return float("nan")
    if isinstance(value, bool):
        raise InputError(f"{key} must be a number or left unknown.")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as error:
        raise InputError(f"{key} must be a number or left unknown.") from error
    if not math.isfinite(parsed):
        raise InputError(f"{key} must be finite.")
    minimum, maximum = NUMERIC_RULES[key]
    if parsed < minimum or parsed > maximum:
        raise InputError(f"{key} must be between {minimum:,} and {maximum:,}.")
    return parsed


def category_optional(payload: dict[str, Any], key: str, allowed: set[str]) -> object:
    value = payload.get(key)
    if value is None or value == "":
        return np.nan
    value = str(value)
    if value not in allowed:
        raise InputError(f"{key} is not a category used by the trained model.")
    return value


def year_built_category(year: float) -> float:
    if math.isnan(year):
        return float("nan")
    categories = ARTIFACT["year_built_categories"]
    eligible = [category for category in categories if category <= int(year)]
    return float(max(eligible) if eligible else min(categories))


def year_moved_category(year: float) -> float:
    if math.isnan(year):
        return float("nan")
    if year >= 2023:
        return 1.0
    if year >= 2021:
        return 2.0
    if year >= 2019:
        return 3.0
    if year >= 2010:
        return 4.0
    if year >= 2000:
        return 5.0
    if year >= 1990:
        return 6.0
    return 7.0


def signed_log(value: float) -> float:
    if math.isnan(value):
        return value
    return math.copysign(math.log1p(abs(value)), value)


def nonnegative_log(value: float) -> float:
    return value if math.isnan(value) else math.log1p(value)


def resolve_zip(payload: dict[str, Any]) -> dict[str, Any]:
    zip_code = str(payload.get("zip_code", "")).strip()
    if not re.fullmatch(r"\d{5}", zip_code):
        raise InputError("Enter a five-digit ZIP code.")
    location = CROSSWALK["data"].get(zip_code)
    if location is None:
        raise InputError(
            "This ZIP is not a supported 2020 ZCTA in California, Florida, New York, Tennessee, or Texas."
        )
    if not location["seen_in_model"]:
        raise InputError("This model area was not represented in the development data.")
    return {"zip_code": zip_code, **location}


def build_frame(payload: dict[str, Any], location: dict[str, Any]) -> pd.DataFrame:
    bedrooms = finite_optional(payload, "bedrooms")
    other_rooms = finite_optional(payload, "other_rooms")
    if not math.isnan(bedrooms) and not math.isnan(other_rooms) and bedrooms + other_rooms > 35:
        raise InputError("Bedrooms plus other rooms must be 35 or fewer.")
    lot_size = payload.get("lot_size")
    if lot_size is None or lot_size == "":
        lot_size_value = float("nan")
    else:
        try:
            lot_size_value = int(lot_size)
        except (TypeError, ValueError) as error:
            raise InputError("lot_size is not a trained category.") from error
        if lot_size_value not in LOT_VALUES:
            raise InputError("lot_size is not a trained category.")

    values = {
        "bedroom_count": bedrooms,
        "non_bedroom_rooms": other_rooms,
        "lot_size_order": lot_size_value,
        "year_built_order": year_built_category(finite_optional(payload, "year_built")),
        "survey_year": 2024.0,
        "signed_log_household_income_2024": signed_log(
            finite_optional(payload, "household_income")
        ),
        "household_size": finite_optional(payload, "household_size"),
        "year_moved_order": year_moved_category(finite_optional(payload, "year_moved")),
        "first_mortgage_log_2024": nonnegative_log(
            finite_optional(payload, "first_mortgage")
        ),
        "hoa_fee_log_2024": nonnegative_log(finite_optional(payload, "hoa_fee")),
        "electricity_log_2024": nonnegative_log(
            finite_optional(payload, "electricity")
        ),
        "gas_log_2024": nonnegative_log(finite_optional(payload, "gas")),
        "other_fuel_log_2024": nonnegative_log(
            finite_optional(payload, "other_fuel")
        ),
        "water_sewer_log_2024": nonnegative_log(
            finite_optional(payload, "water_sewer")
        ),
        "structure_type": category_optional(payload, "structure_type", STRUCTURE_VALUES),
        "heating_fuel": category_optional(payload, "heating_fuel", HEATING_VALUES),
        "state_puma": location["state_puma"],
        "household_type": category_optional(payload, "household_type", HOUSEHOLD_VALUES),
    }
    return pd.DataFrame([values], columns=FEATURES)


def source_feature(transformed_name: str) -> str:
    clean = str(transformed_name).split("__", 1)[-1]
    for feature in sorted(FEATURES, key=len, reverse=True):
        if clean == feature or clean.startswith(feature + "_") or feature in clean:
            return feature
    return clean


def support_diagnostic(frame: pd.DataFrame) -> dict[str, Any]:
    warnings = []
    status = "within_normal_range"
    support = ARTIFACT["support"]
    for feature in FEATURES:
        # 2024 is the intentionally held-forward prediction year used by the
        # notebook's temporal evaluation, not an accidental OOD user input.
        if feature == "survey_year":
            continue
        value = frame.iloc[0][feature]
        if pd.isna(value):
            continue
        detail = support[feature]
        if feature in NUMERIC_FEATURES:
            numeric = float(value)
            if numeric < detail["minimum"] or numeric > detail["maximum"]:
                warnings.append(f"{FEATURE_LABELS[feature]} is outside the observed development range.")
                status = "outside_observed_support"
            elif numeric < detail["p01"] or numeric > detail["p99"]:
                warnings.append(f"{FEATURE_LABELS[feature]} is near the edge of the research data.")
                if status == "within_normal_range":
                    status = "near_edge"
        else:
            count = detail["counts"].get(str(value), 0)
            if count == 0:
                warnings.append(f"{FEATURE_LABELS[feature]} was not observed during development.")
                status = "outside_observed_support"
            elif count < 100:
                warnings.append(f"{FEATURE_LABELS[feature]} is rare in the development data.")
                if status == "within_normal_range":
                    status = "near_edge"
    return {"status": status, "warnings": warnings}


def local_context(location: dict[str, Any], estimate: float) -> dict[str, Any]:
    puma = CONTEXT["state_pumas"].get(location["state_puma"])
    state = CONTEXT["states"].get(location["state_name"])
    if puma is None or state is None:
        raise InputError("No retained 2024 context exists for the resolved model area.")
    if estimate < puma["p25"]:
        position = "below the local interquartile range"
    elif estimate > puma["p75"]:
        position = "above the local interquartile range"
    else:
        position = "within the local interquartile range"
    return {"model_area": puma, "state": state, "study": CONTEXT["study"], "position": position}


def predict_frame(frame: pd.DataFrame) -> dict[str, Any]:
    fitted = MODEL.regressor_
    preprocessing = fitted.named_steps["preprocessing"]
    regression = fitted.named_steps["regression"]
    transformed = preprocessing.transform(frame)
    contributions = regression.get_booster().predict(
        DMatrix(transformed), pred_contribs=True, approx_contribs=False
    )[0]
    transformed_names = preprocessing.get_feature_names_out()
    sources = np.array([source_feature(name) for name in transformed_names])
    semantic = {
        feature: float(contributions[:-1][sources == feature].sum()) for feature in FEATURES
    }
    baseline = float(contributions[-1])
    model_output = baseline + sum(semantic.values())
    direct_output = float(regression.get_booster().predict(DMatrix(transformed))[0])
    dollar_prediction = max(float(np.expm1(direct_output)), 0.0)
    ordered = sorted(semantic.items(), key=lambda item: abs(item[1]), reverse=True)
    largest = max(abs(value) for _, value in ordered) or 1.0
    shap_rows = []
    for rank, (feature, value) in enumerate(ordered, start=1):
        relative = abs(value) / largest
        magnitude = "Strong" if relative >= 0.55 else "Moderate" if relative >= 0.2 else "Small"
        direction = "Relatively neutral" if abs(value) < 0.005 else (
            "Pushes the model prediction higher" if value > 0 else "Pushes the model prediction lower"
        )
        shap_rows.append(
            {
                "rank": rank,
                "feature": feature,
                "label": FEATURE_LABELS[feature],
                "value": value,
                "direction": direction,
                "magnitude": magnitude,
                "units": "log1p property-value units",
            }
        )
    return {
        "estimate": dollar_prediction,
        "prediction_log1p": direct_output,
        "baseline_log1p": baseline,
        "baseline_dollars_for_orientation": float(np.expm1(baseline)),
        "shap": shap_rows,
        "additivity": {
            "expected_plus_shap": model_output,
            "model_output": direct_output,
            "absolute_difference": abs(model_output - direct_output),
            "verified": abs(model_output - direct_output) <= 5e-5,
        },
    }


def sensitivity(payload: dict[str, Any], location: dict[str, Any], current: float) -> list[dict[str, Any]]:
    candidates: list[tuple[str, str, dict[str, Any]]] = []
    bedrooms = payload.get("bedrooms")
    other_rooms = payload.get("other_rooms")
    if bedrooms not in (None, "") and float(bedrooms) < 20:
        candidate = {**payload, "bedrooms": float(bedrooms) + 1}
        candidates.append(("bedrooms", f"{int(float(bedrooms)) + 1} bedrooms", candidate))
    if other_rooms not in (None, "") and float(other_rooms) < 30:
        candidate = {**payload, "other_rooms": float(other_rooms) + 1}
        candidates.append(("other_rooms", f"{int(float(other_rooms)) + 1} other rooms", candidate))
    current_fuel = payload.get("heating_fuel")
    if current_fuel not in (None, ""):
        for fuel in sorted(HEATING_VALUES):
            if fuel != str(current_fuel):
                candidates.append(("heating_fuel", HEATING_LABELS[fuel], {**payload, "heating_fuel": fuel}))

    rows = []
    for feature, scenario_label, candidate in candidates:
        frame = build_frame(candidate, location)
        if support_diagnostic(frame)["status"] == "outside_observed_support":
            continue
        estimate = predict_frame(frame)["estimate"]
        difference = estimate - current
        if difference > 0:
            rows.append(
                {
                    "feature": feature,
                    "label": FEATURE_LABELS["bedroom_count" if feature == "bedrooms" else "non_bedroom_rooms" if feature == "other_rooms" else feature],
                    "scenario": scenario_label,
                    "estimate": estimate,
                    "difference": difference,
                    "percent_difference": difference / current * 100 if current else 0,
                }
            )
    return sorted(rows, key=lambda row: row["difference"], reverse=True)[:3]


def prediction(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise InputError("Request body must be an object.")
    location = resolve_zip(payload)
    frame = build_frame(payload, location)
    result = predict_frame(frame)
    result["location"] = location
    result["support"] = support_diagnostic(frame)
    result["context"] = local_context(location, result["estimate"])
    result["local_drivers"] = LOCAL_DRIVERS.get(location["state_puma"], [])
    result["opportunities"] = sensitivity(payload, location, result["estimate"])
    result["model"] = {
        "name": "Reduced XGBoost - Log1p target (Method 2B)",
        "development_years": "2020-2023",
        "prediction_year": 2024,
        "temporal_mae": 275638.81476808304,
        "temporal_median_absolute_error": 113950.53125,
        "temporal_r_squared": 0.3176961238651559,
        "disclaimer": "Research-model estimate, not an appraisal, market price, or listing recommendation.",
    }
    result["privacy"] = "No name, email, or street address is requested or stored by the service."
    return result


class Handler(BaseHTTPRequestHandler):
    server_version = "HousingValueInference/1.0"

    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        origin = self.headers.get("Origin", "")
        if re.fullmatch(r"https?://(localhost|127\.0\.0\.1)(:\d+)?", origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _send(self, payload: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(payload, allow_nan=False).encode("utf-8")
        self._headers(status)
        self.wfile.write(encoded)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._headers(204)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(
                {
                    "status": "ok",
                    "model": "Reduced XGBoost - Log1p target (Method 2B)",
                    "artifact": ARTIFACT_PATH.name,
                }
            )
            return
        self._send({"error": "Not found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/predict":
            self._send({"error": "Not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 100_000:
                raise InputError("Invalid request size.")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            self._send({"data": prediction(body)})
        except InputError as error:
            self._send({"error": str(error)}, 422)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send({"error": "Request body must be valid JSON."}, 400)
        except Exception as error:  # pragma: no cover - final safety boundary
            self._send({"error": f"Inference failed: {error}"}, 500)

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"[inference] {self.address_string()} {format_string % args}")


def main() -> None:
    host = os.environ.get("HOUSING_INFERENCE_HOST", "127.0.0.1")
    port = int(os.environ.get("HOUSING_INFERENCE_PORT", "8765"))
    print(f"Inference service ready at http://{host}:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
