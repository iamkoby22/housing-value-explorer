'use client';

import { geoAlbersUsa, geoPath } from 'd3-geo';
import { useEffect, useMemo, useState } from 'react';

import { integer } from '@/lib/format';
import type { StateResult } from '@/lib/research-data';

type GeoFeature = {
  type: 'Feature';
  id: string;
  properties: { state_name: string; state_fips: string };
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
};

type GeoCollection = { type: 'FeatureCollection'; features: GeoFeature[] };

export function StateExplorer({
  states,
  labels,
}: {
  states: StateResult[];
  labels: Record<string, string>;
}) {
  const [selectedName, setSelectedName] = useState('California');
  const [geography, setGeography] = useState<GeoCollection | null>(null);

  useEffect(() => {
    fetch('/data/states.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('State geometry could not be loaded');
        return response.json() as Promise<GeoCollection>;
      })
      .then(setGeography)
      .catch(() => setGeography(null));
  }, []);

  const selected =
    states.find((state) => state.state_name === selectedName) ?? states[0];
  const paths = useMemo(() => {
    if (!geography) return [];
    const projection = geoAlbersUsa().fitExtent(
      [
        [20, 20],
        [700, 400],
      ],
      geography as never,
    );
    const renderer = geoPath(projection);
    return geography.features.map((feature) => ({
      name: feature.properties.state_name,
      path: renderer(feature as never) ?? '',
    }));
  }, [geography]);

  return (
    <div className="explorer-grid">
      <div className="map-panel">
        <div className="map-toolbar">
          <label className="select-label">
            State
            <select
              value={selectedName}
              onChange={(event) => setSelectedName(event.target.value)}
            >
              {states.map((state) => (
                <option key={state.state_name}>{state.state_name}</option>
              ))}
            </select>
          </label>
          <span className="map-metric">2024 SHAP summary</span>
        </div>
        {paths.length ? (
          <svg
            className="state-map"
            viewBox="0 0 720 420"
            aria-labelledby="state-map-title state-map-desc"
          >
            <title id="state-map-title">
              Five-state research geography selector
            </title>
            <desc id="state-map-desc">
              Actual Census state geometry for California, Florida, New York,
              Tennessee, and Texas. Select a state to update the details.
            </desc>
            {paths.map((item) => (
              <path
                key={item.name}
                d={item.path}
                className={
                  item.name === selectedName
                    ? 'state-shape selected'
                    : 'state-shape'
                }
                onClick={() => setSelectedName(item.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ')
                    setSelectedName(item.name);
                }}
                tabIndex={0}
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG paths cannot be HTML buttons; this preserves keyboard selection.
                role="button"
                aria-label={`Show ${item.name} results`}
              />
            ))}
          </svg>
        ) : (
          <div className="map-loading" aria-live="polite">
            Loading Census boundary geometry…
          </div>
        )}
        <p className="figure-note">
          State outlines are derived from 2020 Census cartographic boundary
          files used by the research workflow.
        </p>
      </div>

      <aside className="state-detail" aria-live="polite">
        <p className="eyebrow">Selected state</p>
        <h2>{selected.state_name}</h2>
        <dl className="detail-stats">
          <div>
            <dt>2024 records</dt>
            <dd>{integer.format(selected.records)}</dd>
          </div>
          <div>
            <dt>Survey-weight sum</dt>
            <dd>{integer.format(selected.survey_weight_sum)}</dd>
          </div>
          <div>
            <dt>Effective sample size</dt>
            <dd>{integer.format(selected.effective_sample_size)}</dd>
          </div>
        </dl>
        <h3>Leading non-geographic contributions</h3>
        <ol className="rank-list">
          {selected.top_non_geographic_features.map((feature) => (
            <li key={feature.feature}>
              <span className="rank-number">{feature.rank}</span>
              <span>
                <strong>{labels[feature.feature] ?? feature.feature}</strong>
                <small>{feature.average_direction}</small>
              </span>
              <span className="rank-value">
                {feature.importance.toFixed(3)}
              </span>
            </li>
          ))}
        </ol>
        <p className="interpretation-note">
          Importance is mean absolute SHAP in log1p property-value units. It
          measures reliance within the fitted model, not causal influence.
        </p>
      </aside>
    </div>
  );
}
