import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import countyShap from '@/public/data/county-shap.json';
import features from '@/public/data/feature-metadata.json';
import housingEda from '@/public/data/housing-eda.json';
import diagnostics from '@/public/data/model-diagnostics.json';
import models from '@/public/data/model-performance.json';
import pumaShap06 from '@/public/data/puma-shap-06.json';
import pumaShap12 from '@/public/data/puma-shap-12.json';
import pumaShap36 from '@/public/data/puma-shap-36.json';
import pumaShap47 from '@/public/data/puma-shap-47.json';
import pumaShap48 from '@/public/data/puma-shap-48.json';

type BoundaryCollection = {
  features: Array<{ id: string | number }>;
};

const geometry = (name: string) =>
  JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', name), 'utf8'),
  ) as BoundaryCollection;

const countyGeometry = geometry('county-geometry.geojson');
const pumaGeometry06 = geometry('puma-geometry-06.geojson');
const pumaGeometry12 = geometry('puma-geometry-12.geojson');
const pumaGeometry36 = geometry('puma-geometry-36.geojson');
const pumaGeometry47 = geometry('puma-geometry-47.geojson');
const pumaGeometry48 = geometry('puma-geometry-48.geojson');

describe('Phase 2 scientific consistency', () => {
  it('packages every notebook-backed housing explorer dataset', () => {
    expect(Object.keys(housingEda.data).sort()).toEqual([
      'approximate_county_bedrooms',
      'approximate_county_values',
      'bedrooms',
      'bedrooms_rooms',
      'lot_size',
      'lot_size_intervals',
      'mortgage_status',
      'puma_values',
      'state_year_target',
      'structure_type',
      'year_built',
    ]);
    expect(housingEda.data.state_year_target).toHaveLength(25);
    expect(
      housingEda.data.state_year_target.every((row) =>
        Number.isFinite(row.weighted_median_value_2024),
      ),
    ).toBe(true);
  });

  it('uses human labels and explicit encodings for every selected feature', () => {
    expect(features.data).toHaveLength(18);
    expect(
      features.data.every(
        (feature) =>
          feature.display_name &&
          feature.ACS_source &&
          feature.semantic_type &&
          feature.transformation_and_encoding,
      ),
    ).toBe(true);
  });

  it('matches county SHAP identifiers to valid five-state geometry', () => {
    const boundaryIds = new Set(
      countyGeometry.features.map((feature) => String(feature.id)),
    );
    expect(countyGeometry.features.length).toBeGreaterThanOrEqual(236);
    expect(
      countyShap.data.every((row) =>
        boundaryIds.has(String(row.county_id).padStart(5, '0')),
      ),
    ).toBe(true);
    expect(
      countyShap.data.every(
        (row) =>
          row.reliability &&
          Number.isFinite(row.effective_sample_size) &&
          Number.isFinite(row.median_PUMA_county_overlap_pct),
      ),
    ).toBe(true);
  });

  it('matches every 2024 State-PUMA result to its state-specific geometry', () => {
    const pairs = [
      [pumaShap06.data, pumaGeometry06.features],
      [pumaShap12.data, pumaGeometry12.features],
      [pumaShap36.data, pumaGeometry36.features],
      [pumaShap47.data, pumaGeometry47.features],
      [pumaShap48.data, pumaGeometry48.features],
    ] as const;
    expect(pairs.reduce((sum, [rows]) => sum + rows.length, 0)).toBe(868);
    for (const [rows, boundaries] of pairs) {
      const ids = new Set(boundaries.map((feature) => String(feature.id)));
      expect(rows.every((row) => ids.has(row.state_puma_id))).toBe(true);
    }
  });

  it('keeps fold evidence aligned with the reported CV summary', () => {
    const selected = models.data.find(
      (model) => model.cross_validation.selected_for_SHAP,
    );
    const folds = diagnostics.data.cv_folds.filter(
      (row) => row.model === selected?.model,
    );
    expect(folds).toHaveLength(5);
    const meanMae =
      folds.reduce((sum, row) => sum + Number(row.MAE), 0) / folds.length;
    expect(meanMae).toBeCloseTo(
      Number(selected?.cross_validation.mean_CV_MAE),
      5,
    );
  });

  it('preserves predictive, non-causal SHAP terminology', () => {
    expect(countyShap.metadata.caveat).toContain('Descriptive approximation');
    expect(housingEda.metadata.caveat).toContain('no browser-side microdata');
  });
});
