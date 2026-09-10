"""Export existing housing-study results into deterministic, web-ready JSON.

This script never reads raw ACS microdata, trains a model, or changes a result. It
normalizes the authoritative geographic SHAP workbook and notebook-produced CSVs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd


EXPECTED_STATES = ["California", "Florida", "New York", "Tennessee", "Texas"]
STATE_FIPS = {"California": "06", "Florida": "12", "New York": "36", "Tennessee": "47", "Texas": "48"}

FEATURE_PRESENTATION: dict[str, dict[str, str]] = {
    "bedroom_count": {"display_name": "Bedrooms", "category": "Property", "description": "Number of bedrooms in the housing unit."},
    "non_bedroom_rooms": {"display_name": "Other rooms", "category": "Property", "description": "Total rooms minus bedrooms, clipped at zero."},
    "lot_size_order": {"display_name": "Lot size", "category": "Property", "description": "ACS ordered lot-size category."},
    "year_built_order": {"display_name": "Year built", "category": "Property", "description": "ACS construction-era category."},
    "survey_year": {"display_name": "Survey year", "category": "Survey", "description": "ACS PUMS survey year."},
    "signed_log_household_income_2024": {"display_name": "Household income", "category": "Household", "description": "Inflation-adjusted household income represented with a signed log transform."},
    "household_size": {"display_name": "Household size", "category": "Household", "description": "Number of people in the household."},
    "year_moved_order": {"display_name": "Year moved in", "category": "Household", "description": "ACS ordered period when the householder moved into the unit."},
    "first_mortgage_log_2024": {"display_name": "First mortgage payment", "category": "Financial", "description": "Inflation-adjusted monthly first-mortgage payment represented with log1p."},
    "hoa_fee_log_2024": {"display_name": "Condo or HOA fee", "category": "Financial", "description": "Inflation-adjusted condo or homeowners-association fee represented with log1p."},
    "electricity_log_2024": {"display_name": "Electricity cost", "category": "Utilities", "description": "Inflation-adjusted electricity cost represented with log1p."},
    "gas_log_2024": {"display_name": "Gas cost", "category": "Utilities", "description": "Inflation-adjusted gas cost represented with log1p."},
    "other_fuel_log_2024": {"display_name": "Other fuel cost", "category": "Utilities", "description": "Inflation-adjusted other-fuel cost represented with log1p."},
    "water_sewer_log_2024": {"display_name": "Water and sewer cost", "category": "Utilities", "description": "Inflation-adjusted water and sewer cost represented with log1p."},
    "structure_type": {"display_name": "Structure type", "category": "Property", "description": "ACS building or structure category."},
    "heating_fuel": {"display_name": "Heating fuel", "category": "Property", "description": "Primary fuel used to heat the unit."},
    "state_puma": {"display_name": "State–PUMA", "category": "Geography", "description": "State and Public Use Microdata Area, the geography learned directly by the model."},
    "household_type": {"display_name": "Household type", "category": "Household", "description": "ACS household/family composition category."},
}


def clean(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, bool):
        return value
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float):
        return round(value, 10)
    return value


def records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [{str(key): clean(value) for key, value in row.items()} for row in frame.to_dict(orient="records")]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8")


def workbook_table(workbook: Path, sheet: str) -> pd.DataFrame:
    return pd.read_excel(workbook, sheet_name=sheet, header=4).dropna(how="all").reset_index(drop=True)


def rank_list(row: pd.Series, prefix: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for rank in range(1, 6):
        stem = f"{prefix}_rank_{rank}" if prefix else f"rank_{rank}"
        result.append(
            {
                "rank": rank,
                "feature": clean(row[f"{stem}_feature"]),
                "importance": clean(row[f"{stem}_importance"]),
                "mean_signed": clean(row[f"{stem}_mean_signed"]),
                "average_direction": clean(row[f"{stem}_average_direction"]),
                "value_trend": clean(row[f"{stem}_value_trend"]),
                "positive_share_pct": clean(row[f"{stem}_positive_share_pct"]),
            }
        )
    return result


def geo_rows(
    ranking: pd.DataFrame,
    importance: pd.DataFrame,
    direction: pd.DataFrame,
    id_fields: list[str],
) -> list[dict[str, Any]]:
    importance_index = importance.set_index(id_fields)
    direction_index = direction.set_index(id_fields)
    metadata = (
        "effective_sample_size",
        "reliability",
        "records",
        "records_with_overlap_at_least_80_pct",
        "median_PUMA_county_overlap_pct",
        "survey_weight_sum",
    )
    result: list[dict[str, Any]] = []
    for _, row in ranking.iterrows():
        key = tuple(row[field] for field in id_fields)
        lookup_key: Any = key[0] if len(key) == 1 else key
        importance_row = importance_index.loc[lookup_key]
        direction_row = direction_index.loc[lookup_key]
        feature_cols = [column for column in importance_row.index if column not in metadata]
        item = {field: clean(row[field]) for field in id_fields}
        for field in metadata:
            if field in row.index:
                item[field] = clean(row[field])
        item["top_features"] = rank_list(row, "")
        item["top_non_geographic_features"] = rank_list(row, "nongeo")
        item["feature_importance"] = {feature: clean(importance_row[feature]) for feature in feature_cols}
        item["feature_direction"] = {feature: clean(direction_row[feature]) for feature in feature_cols}
        result.append(item)
    return result


def build_states_geojson(county_shapefile: Path) -> dict[str, Any]:
    try:
        import shapefile  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Install requirements.txt to export state geometry") from exc

    def simplify_ring(points: Any, tolerance: float = 0.025) -> list[list[float]]:
        """Ramer-Douglas-Peucker simplification for browser-safe state outlines."""
        ring = [[float(point[0]), float(point[1])] for point in points]
        if len(ring) <= 4:
            return ring
        closed = ring[0] == ring[-1]
        work = ring[:-1] if closed else ring

        def rdp(segment: list[list[float]]) -> list[list[float]]:
            if len(segment) < 3:
                return segment
            start, end = segment[0], segment[-1]
            dx, dy = end[0] - start[0], end[1] - start[1]
            denominator = (dx * dx + dy * dy) ** 0.5
            maximum, index = 0.0, 0
            for position, point in enumerate(segment[1:-1], 1):
                distance = (
                    abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / denominator
                    if denominator
                    else ((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2) ** 0.5
                )
                if distance > maximum:
                    maximum, index = distance, position
            if maximum > tolerance:
                left = rdp(segment[: index + 1])
                right = rdp(segment[index:])
                return left[:-1] + right
            return [start, end]

        simplified = rdp(work)
        if closed and simplified[0] != simplified[-1]:
            simplified.append(simplified[0])
        return simplified if len(simplified) >= 4 else ring

    def simplify_polygon(polygon: Any) -> list[Any]:
        return [simplify_ring(ring) for ring in polygon]

    reader = shapefile.Reader(str(county_shapefile))
    fields = [field[0] for field in reader.fields[1:]]
    state_field = fields.index("STATEFP")
    by_fips: dict[str, list[Any]] = {fips: [] for fips in STATE_FIPS.values()}
    for shape_record in reader.iterShapeRecords():
        fips = str(shape_record.record[state_field]).zfill(2)
        if fips in by_fips:
            geometry = shape_record.shape.__geo_interface__
            if geometry["type"] == "Polygon":
                by_fips[fips].append(simplify_polygon(geometry["coordinates"]))
            elif geometry["type"] == "MultiPolygon":
                by_fips[fips].extend(simplify_polygon(polygon) for polygon in geometry["coordinates"])

    features = []
    for state, fips in STATE_FIPS.items():
        if not by_fips[fips]:
            raise ValueError(f"No boundary geometry found for {state}")
        features.append(
            {
                "type": "Feature",
                "id": fips,
                "properties": {"state_name": state, "state_fips": fips},
                "geometry": {"type": "MultiPolygon", "coordinates": by_fips[fips]},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def simplify_geometry(geometry: dict[str, Any], tolerance: float = 0.01) -> dict[str, Any]:
    """Reduce boundary payload size without changing topology or attributes."""

    def simplify_ring(points: Any) -> list[list[float]]:
        ring = [[float(point[0]), float(point[1])] for point in points]
        if len(ring) <= 4:
            return ring
        closed = ring[0] == ring[-1]
        work = ring[:-1] if closed else ring

        def rdp(segment: list[list[float]]) -> list[list[float]]:
            if len(segment) < 3:
                return segment
            start, end = segment[0], segment[-1]
            dx, dy = end[0] - start[0], end[1] - start[1]
            denominator = (dx * dx + dy * dy) ** 0.5
            maximum, index = 0.0, 0
            for position, point in enumerate(segment[1:-1], 1):
                distance = (
                    abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / denominator
                    if denominator
                    else ((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2) ** 0.5
                )
                if distance > maximum:
                    maximum, index = distance, position
            if maximum > tolerance:
                left = rdp(segment[: index + 1])
                right = rdp(segment[index:])
                return left[:-1] + right
            return [start, end]

        simplified = rdp(work)
        if closed and simplified[0] != simplified[-1]:
            simplified.append(simplified[0])
        return simplified if len(simplified) >= 4 else ring

    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        simplified = [simplify_ring(ring) for ring in coordinates]
    elif geometry["type"] == "MultiPolygon":
        simplified = [
            [simplify_ring(ring) for ring in polygon] for polygon in coordinates
        ]
    else:
        raise ValueError(f"Unsupported boundary type: {geometry['type']}")
    return {"type": geometry["type"], "coordinates": simplified}


def build_local_geographies(
    county_shapefile: Path, boundary_root: Path, output: Path
) -> list[str]:
    """Export the five-state county and per-state PUMA boundaries used by the study."""
    try:
        import shapefile  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Install requirements.txt to export geography") from exc

    county_reader = shapefile.Reader(str(county_shapefile))
    county_fields = [field[0] for field in county_reader.fields[1:]]
    county_features = []
    expected_fips = set(STATE_FIPS.values())
    for shape_record in county_reader.iterShapeRecords():
        row = dict(zip(county_fields, shape_record.record))
        state_fips = str(row["STATEFP"]).zfill(2)
        if state_fips not in expected_fips:
            continue
        county_id = str(row["GEOID"]).zfill(5)
        county_features.append(
            {
                "type": "Feature",
                "id": county_id,
                "properties": {
                    "county_id": county_id,
                    "county_label": str(row["NAMELSAD"]),
                    "state_name": str(row["STATE_NAME"]),
                    "state_fips": state_fips,
                },
                "geometry": simplify_geometry(shape_record.shape.__geo_interface__),
            }
        )
    county_name = "county-geometry.geojson"
    write_json(
        output / county_name,
        {"type": "FeatureCollection", "features": county_features},
    )

    folder_by_state = {
        "California": "California",
        "Florida": "Florida",
        "New York": "New_York",
        "Tennessee": "Tennessee",
        "Texas": "Texas",
    }
    output_names = [county_name]
    for state_name, folder in folder_by_state.items():
        state_fips = STATE_FIPS[state_name]
        source = boundary_root / folder / f"cb_2020_{state_fips}_puma20_500k.shp"
        reader = shapefile.Reader(str(source))
        fields = [field[0] for field in reader.fields[1:]]
        features = []
        for shape_record in reader.iterShapeRecords():
            row = dict(zip(fields, shape_record.record))
            puma_code = str(row["PUMACE20"]).zfill(5)
            state_puma_id = f"{state_fips}_{puma_code}"
            features.append(
                {
                    "type": "Feature",
                    "id": state_puma_id,
                    "properties": {
                        "state_puma_id": state_puma_id,
                        "state_name": state_name,
                        "state_fips": state_fips,
                        "puma_name": str(row["NAMELSAD20"]),
                    },
                    "geometry": simplify_geometry(shape_record.shape.__geo_interface__),
                }
            )
        name = f"puma-geometry-{state_fips}.geojson"
        write_json(output / name, {"type": "FeatureCollection", "features": features})
        output_names.append(name)
    return output_names


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--notebook", type=Path, required=True)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--publication-dir", type=Path, required=True)
    parser.add_argument("--figures-dir", type=Path, required=True)
    parser.add_argument("--county-shapefile", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    for source in (args.notebook, args.workbook, args.publication_dir, args.figures_dir, args.county_shapefile):
        if not source.exists():
            raise FileNotFoundError(source)
    args.output.mkdir(parents=True, exist_ok=True)

    feature_source = args.publication_dir / "selected_model_feature_dictionary.csv"
    feature_frame = pd.read_csv(feature_source)
    features = feature_frame["feature"].tolist()
    if features != list(FEATURE_PRESENTATION):
        raise ValueError("Feature dictionary no longer matches the reviewed 18-feature registry")
    feature_payload = []
    for row in records(feature_frame):
        item = {**row, **FEATURE_PRESENTATION[row["feature"]]}
        feature_payload.append(item)

    state_rankings = workbook_table(args.workbook, "State Rankings")
    county_rankings = workbook_table(args.workbook, "County Rankings")
    puma_rankings = workbook_table(args.workbook, "PUMA Rankings")
    states = sorted(state_rankings["state_name"].tolist())
    if states != sorted(EXPECTED_STATES):
        raise ValueError(f"Expected five study states, found {states}")
    if len(county_rankings) != 236 or county_rankings["county_id"].duplicated().any():
        raise ValueError("Approximate county table must contain 236 unique county IDs")
    if county_rankings["reliability"].isna().any():
        raise ValueError("Every approximate county must include reliability metadata")
    if len(puma_rankings) != 868 or puma_rankings["state_puma_id"].duplicated().any():
        raise ValueError("State-PUMA table must contain 868 unique IDs")

    state_payload = geo_rows(
        state_rankings,
        workbook_table(args.workbook, "State Importance"),
        workbook_table(args.workbook, "State Direction"),
        ["state_name"],
    )
    county_payload = geo_rows(
        county_rankings,
        workbook_table(args.workbook, "County Importance"),
        workbook_table(args.workbook, "County Direction"),
        ["state_name", "county_id", "county_label"],
    )
    puma_payload = geo_rows(
        puma_rankings,
        workbook_table(args.workbook, "PUMA Importance"),
        workbook_table(args.workbook, "PUMA Direction"),
        ["state_name", "state_puma_id"],
    )

    cv = pd.read_csv(args.publication_dir / "final_model_cv_uncertainty.csv")
    temporal = pd.read_csv(args.publication_dir / "cv_vs_2024_temporal_evaluation.csv")
    model_performance = []
    for _, row in cv.iterrows():
        temporal_row = temporal.loc[temporal["model"] == row["model"]].iloc[0]
        model_performance.append({"model": row["model"], "cross_validation": {key: clean(value) for key, value in row.items() if key != "model"}, "temporal_2024": {key: clean(value) for key, value in temporal_row.items() if key not in {"model", "mean_CV_MAE", "lower_95_CV_MAE", "upper_95_CV_MAE", "mean_CV_R_squared", "lower_95_CV_R_squared", "upper_95_CV_R_squared"}}})

    global_shap = pd.read_csv(args.figures_dir / "method2b_tree_shap_global_importance.csv")
    if set(global_shap["feature"]) != set(features):
        raise ValueError("Global SHAP features do not match the selected model dictionary")

    method = workbook_table(args.workbook, "Method")
    questions = pd.read_csv(args.publication_dir / "publication_research_questions_and_contribution.csv")
    leakage = pd.read_csv(args.publication_dir / "temporal_split_and_leakage_audit.csv")
    limitations = pd.read_csv(args.publication_dir / "publication_limitations_and_claim_boundaries.csv")

    eda_sources = {
        "mortgage_status": args.figures_dir / "figure_02_homeowner_mortgage_status_summary.csv",
        "approximate_county_values": args.figures_dir / "figure_06_approximate_county_summary.csv",
        "bedrooms_rooms": args.figures_dir / "figure_07_bedroom_room_summary.csv",
        "approximate_county_bedrooms": args.figures_dir / "figure_08_bedrooms_by_approximate_county_summary.csv",
        "puma_values": args.figures_dir / "figure_09_puma_property_value_summary.csv",
        "year_built": args.figures_dir / "figure_10_property_value_by_year_built_summary.csv",
        "bedrooms": args.figures_dir / "figure_11_weighted_median_bedrooms_property_value_summary.csv",
        "structure_type": args.figures_dir / "figure_12_property_value_by_structure_type_state_summary.csv",
        "lot_size": args.figures_dir / "figure_13_property_value_by_lot_size_state_summary.csv",
        "lot_size_intervals": args.figures_dir / "figure_13_lot_size_property_value_forest_summary.csv",
        "state_year_target": args.publication_dir / "acs_target_measurement_audit.csv",
    }
    for source in eda_sources.values():
        if not source.exists():
            raise FileNotFoundError(source)
    eda_payload = {
        name: records(pd.read_csv(source)) for name, source in eda_sources.items()
    }

    diagnostic_sources = {
        "cv_folds": args.publication_dir / "final_model_cv_fold_results.csv",
        "target_measurement": args.publication_dir / "acs_target_measurement_audit.csv",
        "state_stability": args.publication_dir / "state_SHAP_ranking_bootstrap_stability.csv",
        "county_stability": args.publication_dir / "county_SHAP_ranking_bootstrap_stability.csv",
        "state_nongeographic_share": args.publication_dir / "state_non_geographic_SHAP_share.csv",
        "state_dependence": args.publication_dir / "state_SHAP_dependence_binned.csv",
    }
    diagnostic_payload = {
        name: records(pd.read_csv(source)) for name, source in diagnostic_sources.items()
    }

    reliability_counts = county_rankings["reliability"].value_counts().to_dict()
    study_summary = {
        "title": "Unboxing the Black Box",
        "subtitle": "Geographic variation in machine-learning explanations of U.S. housing values",
        "states": EXPECTED_STATES,
        "development_period": "2020–2023",
        "temporal_evaluation_year": 2024,
        "development_records": 960182,
        "explanation_records_2024": 268930,
        "state_count": 5,
        "approximate_county_count": 236,
        "state_puma_count": 868,
        "model_feature_count": 18,
        "selected_model": "Reduced XGBoost with log1p property-value target",
        "state_records": [{"state_name": item["state_name"], "records": item["records"], "survey_weight_sum": item["survey_weight_sum"], "effective_sample_size": item["effective_sample_size"]} for item in state_payload],
        "county_reliability_counts": {str(key): int(value) for key, value in reliability_counts.items()},
    }

    common_meta = {
        "generated_by": "scripts/export_research_data.py",
        "scientific_role": "Presentation-only normalization of existing analytical outputs",
    }
    write_json(args.output / "study-summary.json", {"metadata": {**common_meta, "unit": "records and geographic counts", "weighting": "Housing-unit weights where indicated"}, "data": study_summary})
    write_json(args.output / "feature-metadata.json", {"metadata": {**common_meta, "source": str(feature_source)}, "data": feature_payload})
    write_json(args.output / "model-performance.json", {"metadata": {**common_meta, "development": "2020–2023 five-fold CV", "evaluation": "2024 temporal evaluation only", "currency_unit": "2024-comparable U.S. dollars"}, "data": model_performance})
    write_json(args.output / "global-shap.json", {"metadata": {**common_meta, "unit": "log1p property-value SHAP units", "weighting": "Housing-unit survey weights", "caveat": "Predictive contribution, not causal effect"}, "data": records(global_shap)})
    write_json(args.output / "state-shap.json", {"metadata": {**common_meta, "geographic_level": "state", "unit": "log1p property-value SHAP units", "weighting": "Housing-unit survey weights", "caveat": "Predictive contribution, not causal effect"}, "data": state_payload})
    write_json(args.output / "county-shap.json", {"metadata": {**common_meta, "geographic_level": "dominant-overlap approximate county", "unit": "log1p property-value SHAP units", "weighting": "Housing-unit survey weights", "caveat": "Descriptive approximation from largest PUMA–county overlap; not an exact household county"}, "data": county_payload})
    write_json(args.output / "puma-shap.json", {"metadata": {**common_meta, "geographic_level": "State-PUMA", "unit": "log1p property-value SHAP units", "weighting": "Housing-unit survey weights", "caveat": "Geography entered directly into the fitted model"}, "data": puma_payload})
    for state_name, state_fips in STATE_FIPS.items():
        state_rows = [row for row in puma_payload if row["state_name"] == state_name]
        write_json(
            args.output / f"puma-shap-{state_fips}.json",
            {
                "metadata": {
                    **common_meta,
                    "geographic_level": "State-PUMA",
                    "state": state_name,
                    "unit": "log1p property-value SHAP units",
                    "weighting": "Housing-unit survey weights",
                    "caveat": "Geography entered directly into the fitted model",
                },
                "data": state_rows,
            },
        )
    write_json(args.output / "shap-dependence.json", {"metadata": {**common_meta, "unit": "log1p property-value SHAP units", "weighting": "Housing-unit survey weights", "caveat": "Modeled association, not an intervention or causal effect"}, "data": records(pd.read_csv(args.publication_dir / "shap_dependence_binned_non_geographic.csv"))})
    write_json(args.output / "methodology.json", {"metadata": common_meta, "data": {"method": records(method), "research_questions": records(questions), "leakage_audit": records(leakage), "limitations": records(limitations)}})
    write_json(args.output / "housing-eda.json", {"metadata": {**common_meta, "unit": "2024-comparable U.S. dollars where monetary", "weighting": "Housing-unit survey weights for reported estimates", "caveat": "Existing notebook summaries only; no browser-side microdata or recalculation"}, "data": eda_payload})
    write_json(args.output / "model-diagnostics.json", {"metadata": {**common_meta, "caveat": "Existing validation, target-audit, and bootstrap outputs only"}, "data": diagnostic_payload})
    write_json(args.output / "states.geojson", build_states_geojson(args.county_shapefile))
    geography_outputs = build_local_geographies(
        args.county_shapefile, args.county_shapefile.parent.parent, args.output
    )

    source_files = list(dict.fromkeys([
        args.notebook,
        args.workbook,
        feature_source,
        args.publication_dir / "final_model_cv_uncertainty.csv",
        args.publication_dir / "cv_vs_2024_temporal_evaluation.csv",
        args.publication_dir / "shap_dependence_binned_non_geographic.csv",
        args.figures_dir / "method2b_tree_shap_global_importance.csv",
        args.county_shapefile,
        *eda_sources.values(),
        *diagnostic_sources.values(),
    ]))
    manifest = {
        "generator": common_meta,
        "sources": [{"path": str(path), "sha256": sha256(path), "bytes": path.stat().st_size} for path in source_files],
        "outputs": sorted(
            [path.name for path in args.output.glob("*.json") if path.name != "source-manifest.json"]
            + ["states.geojson", *geography_outputs]
        ),
        "validation": {
            "expected_states": EXPECTED_STATES,
            "features": len(features),
            "approximate_counties": len(county_payload),
            "state_pumas": len(puma_payload),
            "county_reliability_present": True,
        },
    }
    write_json(args.output / "source-manifest.json", manifest)
    print(f"Exported {len(manifest['outputs'])} datasets to {args.output}")


if __name__ == "__main__":
    main()
