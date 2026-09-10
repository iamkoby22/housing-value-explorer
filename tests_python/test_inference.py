from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from inference import valuation_service as service  # noqa: E402


BASE_PROFILE = {
    "zip_code": "37601",
    "bedrooms": 3,
    "other_rooms": 4,
    "lot_size": 1,
    "year_built": 1995,
    "structure_type": "2",
    "heating_fuel": "3",
    "household_income": 85_000,
    "household_size": 3,
    "household_type": "1",
    "year_moved": 2018,
    "first_mortgage": 1_800,
    "hoa_fee": 0,
    "electricity": 160,
    "gas": 80,
    "other_fuel": 0,
    "water_sewer": 900,
}


class ModelArtifactTests(unittest.TestCase):
    def test_exact_selected_feature_schema_is_loaded(self) -> None:
        self.assertEqual(len(service.FEATURES), 18)
        self.assertEqual(service.ARTIFACT["training_records"], 960_182)
        self.assertEqual(service.MODEL.regressor_.named_steps["regression"].n_estimators, 600)

    def test_serialized_regression_fixtures_match_log_and_dollar_outputs(self) -> None:
        fixtures = json.loads(
            (ROOT / "model_artifacts" / "inference-regression-fixtures.json").read_text(
                encoding="utf-8"
            )
        )["data"]
        for fixture in fixtures:
            row = {
                key: np.nan if value is None else value
                for key, value in fixture["features"].items()
            }
            frame = pd.DataFrame([row], columns=service.FEATURES)
            fitted = service.MODEL.regressor_
            transformed = fitted.named_steps["preprocessing"].transform(frame)
            log_value = float(fitted.named_steps["regression"].predict(transformed)[0])
            dollar_value = float(service.MODEL.predict(frame)[0])
            self.assertAlmostEqual(log_value, fixture["prediction_log1p"], places=6)
            self.assertAlmostEqual(dollar_value, fixture["prediction_dollars"], places=6)

    def test_inverse_transformation_is_expm1(self) -> None:
        frame = service.build_frame(BASE_PROFILE, service.resolve_zip(BASE_PROFILE))
        result = service.predict_frame(frame)
        self.assertAlmostEqual(
            result["estimate"], math.expm1(result["prediction_log1p"]), places=6
        )


class GeographyTests(unittest.TestCase):
    def test_supported_zip_resolves_by_census_crosswalk(self) -> None:
        location = service.resolve_zip({"zip_code": "37601"})
        self.assertEqual(location["state_name"], "Tennessee")
        self.assertEqual(location["state_puma"], "47_01201")
        self.assertEqual(location["intersecting_pumas"], 2)

    def test_unsupported_state_zip_is_END(self) -> None:
        with self.assertRaises(service.InputError):
            service.resolve_zip({"zip_code": "60601"})

    def test_malformed_zip_is_rejected(self) -> None:
        with self.assertRaises(service.InputError):
            service.resolve_zip({"zip_code": "3760A"})


class InferenceTests(unittest.TestCase):
    def test_prediction_is_deterministic(self) -> None:
        first = service.prediction(BASE_PROFILE)
        second = service.prediction(BASE_PROFILE)
        self.assertAlmostEqual(first["estimate"], second["estimate"], places=9)
        self.assertEqual(first["shap"], second["shap"])

    def test_local_shap_is_semantic_and_additive(self) -> None:
        result = service.prediction(BASE_PROFILE)
        self.assertEqual(len(result["shap"]), 18)
        self.assertEqual({row["feature"] for row in result["shap"]}, set(service.FEATURES))
        self.assertTrue(result["additivity"]["verified"])
        self.assertLessEqual(result["additivity"]["absolute_difference"], 5e-5)

    def test_scenario_runs_actual_model(self) -> None:
        current = service.prediction(BASE_PROFILE)
        scenario = service.prediction({**BASE_PROFILE, "bedrooms": 4})
        self.assertNotEqual(current["prediction_log1p"], scenario["prediction_log1p"])
        self.assertEqual(current["model"]["name"], scenario["model"]["name"])

    def test_unknown_values_use_fitted_missingness_path(self) -> None:
        sparse = {key: None for key in BASE_PROFILE}
        sparse["zip_code"] = "37601"
        result = service.prediction(sparse)
        self.assertGreater(result["estimate"], 0)
        self.assertTrue(math.isfinite(result["estimate"]))

    def test_invalid_numbers_and_categories_are_rejected(self) -> None:
        for update in [
            {"bedrooms": -1},
            {"bedrooms": float("inf")},
            {"first_mortgage": -10},
            {"structure_type": "9"},
        ]:
            with self.subTest(update=update), self.assertRaises(service.InputError):
                service.prediction({**BASE_PROFILE, **update})


if __name__ == "__main__":
    unittest.main()
