import { describe, expect, it } from 'vitest';

import countyJson from '@/public/data/county-shap.json';
import manifestJson from '@/public/data/source-manifest.json';
import pumaJson from '@/public/data/puma-shap.json';
import {
  dependence,
  features,
  globalShap,
  models,
  states,
  studySummary,
} from '@/lib/research-data';

describe('research data contract', () => {
  it('contains exactly the five documented states', () => {
    expect(states.map((state) => state.state_name).sort()).toEqual([
      'California',
      'Florida',
      'New York',
      'Tennessee',
      'Texas',
    ]);
  });

  it('keeps the selected model feature registry aligned with SHAP', () => {
    expect(features).toHaveLength(18);
    expect(new Set(globalShap.map((row) => row.feature))).toEqual(
      new Set(features.map((row) => row.feature)),
    );
    expect(
      features.every((feature) => feature.display_name && feature.ACS_source),
    ).toBe(true);
  });

  it('retains unique geographic identifiers and county reliability', () => {
    const counties = countyJson.data;
    const pumas = pumaJson.data;
    expect(counties).toHaveLength(236);
    expect(new Set(counties.map((county) => county.county_id)).size).toBe(236);
    expect(counties.every((county) => county.reliability)).toBe(true);
    expect(
      counties.every(
        (county) => typeof county.median_PUMA_county_overlap_pct === 'number',
      ),
    ).toBe(true);
    expect(pumas).toHaveLength(868);
    expect(new Set(pumas.map((puma) => puma.state_puma_id)).size).toBe(868);
  });

  it('preserves the temporal split and selected model', () => {
    expect(studySummary.development_period).toBe('2020–2023');
    expect(studySummary.temporal_evaluation_year).toBe(2024);
    expect(studySummary.explanation_records_2024).toBe(268930);
    const selected = models.filter(
      (model) => model.cross_validation.selected_for_SHAP,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].model).toBe('Reduced XGBoost (selected)');
  });

  it('contains numeric dependence outputs for six non-geographic features', () => {
    expect(new Set(dependence.map((row) => row.feature)).size).toBe(6);
    expect(
      dependence.every((row) => Number.isFinite(row.weighted_mean_SHAP)),
    ).toBe(true);
  });

  it('records source hashes and exporter validations', () => {
    expect(manifestJson.sources.length).toBeGreaterThanOrEqual(8);
    expect(
      manifestJson.sources.every((source) =>
        /^[a-f0-9]{64}$/.test(source.sha256),
      ),
    ).toBe(true);
    expect(manifestJson.validation.county_reliability_present).toBe(true);
  });
});
