import { describe, expect, it } from 'vitest';

import audit from '@/model_artifacts/inference-audit.json';
import context from '@/public/data/valuation-context.json';
import crosswalk from '@/public/data/zip-puma-crosswalk.json';

describe('Phase 3 scientific artifacts', () => {
  it('records an exact temporal reproduction and serialization round trip', () => {
    expect(audit.model).toContain('Reduced XGBoost');
    expect(audit.training_records).toBe(960_182);
    expect(audit.temporal_records).toBe(268_930);
    expect(audit.metric_differences).toEqual({
      mae: 0,
      rmse: 0,
      r_squared: 0,
    });
    expect(audit.serialization_max_prediction_difference).toBe(0);
  });

  it('uses the official 2020 Census ZCTA-PUMA relationship source', () => {
    expect(crosswalk.metadata.source).toContain('U.S. Census Bureau');
    expect(crosswalk.metadata.vintage).toBe(2020);
    expect(crosswalk.metadata.supported_states).toEqual([
      'California',
      'Florida',
      'New York',
      'Tennessee',
      'Texas',
    ]);
    expect(crosswalk.data['37601'].state_puma).toBe('47_01201');
    expect(crosswalk.data['37601'].alternatives[0].area_share).toBeGreaterThan(
      crosswalk.data['37601'].alternatives[1].area_share,
    );
  });

  it('retains ordered observed context quantiles for every modeled PUMA', () => {
    expect(Object.keys(context.state_pumas)).toHaveLength(868);
    for (const area of Object.values(context.state_pumas)) {
      expect(area.p10).toBeLessThanOrEqual(area.p25);
      expect(area.p25).toBeLessThanOrEqual(area.p50);
      expect(area.p50).toBeLessThanOrEqual(area.p75);
      expect(area.p75).toBeLessThanOrEqual(area.p90);
    }
  });
});
