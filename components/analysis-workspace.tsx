'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { geoMercator, geoPath } from 'd3-geo';

import { dollars, integer } from '@/lib/format';
import {
  defaultWorkspaceState,
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  type WorkspaceModule,
  workspaceReducer,
} from '@/lib/workspace-state';

type Envelope<T> = { metadata: Record<string, unknown>; data: T };
type DataRow = Record<string, string | number | boolean | null>;
type EdaData = Record<string, DataRow[]>;
type DiagnosticData = Record<string, DataRow[]>;
type Feature = {
  feature: string;
  display_name: string;
  category: string;
  description: string;
  ACS_source: string;
  semantic_type: string;
  transformation_and_encoding: string;
  remaining_missing_handling: string;
};
type RankedFeature = {
  rank: number;
  feature: string;
  importance: number;
  mean_signed: number;
  average_direction: string;
  value_trend: string;
  positive_share_pct: number;
};
type GeoResult = {
  state_name: string;
  county_id?: number;
  county_label?: string;
  state_puma_id?: string;
  records: number;
  survey_weight_sum: number;
  effective_sample_size: number;
  reliability?: string;
  median_PUMA_county_overlap_pct?: number;
  records_with_overlap_at_least_80_pct?: number;
  top_features: RankedFeature[];
  top_non_geographic_features: RankedFeature[];
  feature_importance: Record<string, number>;
  feature_direction: Record<string, number>;
};
type GlobalShap = {
  feature: string;
  survey_weighted_mean_absolute_SHAP: number;
};
type Dependence = {
  feature: string;
  feature_bin: string;
  weighted_mean_feature_value: number;
  weighted_mean_SHAP: number;
  lower_95_SHAP: number;
  upper_95_SHAP: number;
  records: number;
};
type ModelResult = {
  model: string;
  cross_validation: Record<string, unknown>;
  temporal_2024: Record<string, unknown>;
};
type BoundaryFeature = {
  type: 'Feature';
  id: string;
  properties: Record<string, string>;
  geometry: { type: string; coordinates: unknown };
};
type BoundaryCollection = {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
};

const STATES = ['California', 'Florida', 'New York', 'Tennessee', 'Texas'];
const STATE_FIPS: Record<string, string> = {
  California: '06',
  Florida: '12',
  'New York': '36',
  Tennessee: '47',
  Texas: '48',
};

const moduleLabels: Record<WorkspaceModule, string> = {
  housing: 'Housing',
  geography: 'Geography',
  compare: 'Compare',
  drivers: 'Drivers & SHAP',
  models: 'Model performance',
  diagnostics: 'Diagnostics',
  methodology: 'Methodology',
};

export type WorkspaceScope = 'explore' | 'drivers' | 'model';

const scopedModules: Record<WorkspaceScope, WorkspaceModule[]> = {
  explore: ['housing', 'geography', 'compare'],
  drivers: ['drivers'],
  model: ['models', 'diagnostics'],
};

function useDataset<T>(path: string | null) {
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    fetch(path, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${path}`);
        return response.json() as Promise<Envelope<T>>;
      })
      .then((payload) => setResult({ path, data: payload.data, error: '' }))
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') {
          setResult({ path, data: null, error: reason.message });
        }
      });
    return () => controller.abort();
  }, [path]);
  return {
    data: result?.path === path ? result.data : null,
    error: result?.path === path ? result.error : '',
  };
}

function useGeoJson(path: string | null) {
  const [result, setResult] = useState<{
    path: string;
    data: BoundaryCollection | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    fetch(path, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${path}`);
        return response.json() as Promise<BoundaryCollection>;
      })
      .then((data) => setResult({ path, data, error: '' }))
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') {
          setResult({ path, data: null, error: reason.message });
        }
      });
    return () => controller.abort();
  }, [path]);
  return {
    data: result?.path === path ? result.data : null,
    error: result?.path === path ? result.error : '',
  };
}

function Loading({ error }: { error?: string }) {
  return (
    <output className={error ? 'workspace-error' : 'workspace-loading'}>
      {error || 'Loading verified research output…'}
    </output>
  );
}

function WorkspaceContext({
  scope,
  module,
  stateName,
  level,
  feature,
  metric,
  features,
  onState,
  onLevel,
  onFeature,
  onMetric,
}: {
  scope: WorkspaceScope;
  module: WorkspaceModule;
  stateName: string;
  level: string;
  feature: string;
  metric: string;
  features: Feature[];
  onState: (value: string) => void;
  onLevel: (value: 'state' | 'county' | 'puma') => void;
  onFeature: (value: string) => void;
  onMetric: (value: 'importance' | 'direction') => void;
}) {
  const scopeCopy = {
    explore: {
      title: 'Explore',
      description:
        'Interact with housing, geographic, and model-derived patterns.',
    },
    drivers: {
      title: 'Drivers',
      description: 'Understand the features shaping model predictions.',
    },
    model: {
      title: 'Model',
      description: 'Inspect model development, validation, and diagnostics.',
    },
  }[scope];
  const needsGeography = [
    'housing',
    'geography',
    'compare',
    'drivers',
  ].includes(module);
  return (
    <header className="workspace-context">
      <div>
        <span className="context-kicker">{moduleLabels[module]}</span>
        <strong>{scopeCopy.title}</strong>
        <small>{scopeCopy.description}</small>
      </div>
      <div className="context-controls">
        {needsGeography ? (
          <label>
            State
            <select
              value={stateName}
              onChange={(event) => onState(event.target.value)}
            >
              {STATES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {['geography', 'compare'].includes(module) ? (
          <label>
            Geography
            <select
              value={level}
              onChange={(event) =>
                onLevel(event.target.value as 'state' | 'county' | 'puma')
              }
            >
              <option value="state">State</option>
              <option value="county">Approximate county</option>
              <option value="puma">State–PUMA</option>
            </select>
          </label>
        ) : null}
        {module === 'drivers' ? (
          <>
            <label>
              Feature
              <select
                value={feature}
                onChange={(event) => onFeature(event.target.value)}
              >
                {features.map((item) => (
                  <option key={item.feature} value={item.feature}>
                    {item.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Measure
              <select
                value={metric}
                onChange={(event) =>
                  onMetric(event.target.value as 'importance' | 'direction')
                }
              >
                <option value="importance">Importance</option>
                <option value="direction">Average direction</option>
              </select>
            </label>
          </>
        ) : null}
      </div>
    </header>
  );
}

function HousingExplorer({ stateName }: { stateName: string }) {
  const { data, error } = useDataset<EdaData>('/data/housing-eda.json');
  const [topic, setTopic] = useState('state_year_target');
  if (!data) return <Loading error={error} />;
  const topicOptions = [
    ['state_year_target', 'Value by year'],
    ['bedrooms', 'Bedrooms'],
    ['year_built', 'Year built'],
    ['structure_type', 'Structure type'],
    ['lot_size_intervals', 'Lot size'],
    ['mortgage_status', 'Mortgage status'],
    ['bedrooms_rooms', 'Bedrooms × rooms'],
  ];
  const rows = data[topic].filter(
    (row) => !('state_name' in row) || row.state_name === stateName,
  );
  const config: Record<string, { x: string; y: string; title: string }> = {
    state_year_target: {
      x: 'survey_year',
      y: 'weighted_median_value_2024',
      title:
        'How did the weighted median reported value move across survey years?',
    },
    bedrooms: {
      x: 'bedroom_count',
      y: 'weighted_median_value',
      title: 'How does typical reported value vary with bedroom count?',
    },
    year_built: {
      x: 'build_period',
      y: 'weighted_median_value',
      title: 'How does typical value differ across construction eras?',
    },
    structure_type: {
      x: 'structure_type',
      y: 'weighted_median_value',
      title: 'How does typical value differ by structure type?',
    },
    lot_size_intervals: {
      x: 'lot_size_category',
      y: 'weighted_median',
      title: 'How does typical value differ across lot-size categories?',
    },
  };
  const selected = config[topic];
  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Housing explorer · {stateName}</p>
          <h1>Begin with the housing landscape</h1>
        </div>
        <p>
          Survey-weighted notebook summaries provide context before model
          explanations. Every monetary value is expressed in comparable 2024
          dollars.
        </p>
      </div>
      <div className="topic-tabs" role="tablist" aria-label="Housing topics">
        {topicOptions.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={topic === id}
            onClick={() => setTopic(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {selected ? (
        <article className="workspace-card wide-card">
          <div className="card-heading">
            <div>
              <span>Research question</span>
              <h2>{selected.title}</h2>
            </div>
            <strong>{stateName}</strong>
          </div>
          <ResponsiveContainer width="100%" height={420}>
            {topic === 'state_year_target' ||
            topic === 'bedrooms' ||
            topic === 'year_built' ? (
              <LineChart
                data={rows}
                margin={{ top: 18, right: 28, bottom: 70, left: 28 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#ded8cb"
                  strokeDasharray="2 4"
                />
                <XAxis
                  dataKey={selected.x}
                  angle={topic === 'year_built' ? -30 : 0}
                  textAnchor={topic === 'year_built' ? 'end' : 'middle'}
                  height={topic === 'year_built' ? 92 : 44}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    `$${Math.round(Number(value) / 1000)}k`
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value) => dollars.format(Number(value))} />
                <Line
                  type="monotone"
                  dataKey={selected.y}
                  name="Weighted median value"
                  stroke="#176b55"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#fffdf8', strokeWidth: 2 }}
                />
              </LineChart>
            ) : (
              <BarChart
                data={rows}
                margin={{ top: 18, right: 28, bottom: 92, left: 28 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#ded8cb"
                  strokeDasharray="2 4"
                />
                <XAxis
                  dataKey={selected.x}
                  angle={-28}
                  textAnchor="end"
                  height={105}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    `$${Math.round(Number(value) / 1000)}k`
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value) => dollars.format(Number(value))} />
                <Bar
                  dataKey={selected.y}
                  name="Weighted median value"
                  fill="#176b55"
                />
              </BarChart>
            )}
          </ResponsiveContainer>
          <details className="chart-data-table">
            <summary>View chart data</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{selected.x.replaceAll('_', ' ')}</th>
                    <th>Weighted median value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row[selected.x]}-${index}`}>
                      <th>{row[selected.x]}</th>
                      <td>{dollars.format(Number(row[selected.y]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="workspace-caveat">
            Descriptive association only. Values are owner estimates from ACS
            PUMS, not transaction prices or appraisals.
          </p>
        </article>
      ) : topic === 'mortgage_status' ? (
        <article className="workspace-card wide-card">
          <div className="card-heading">
            <div>
              <span>Ownership status</span>
              <h2>What share of homeowners report a mortgage?</h2>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ left: 18, right: 30 }}
            >
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="state_name" width={90} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Legend />
              <Bar
                dataKey="weighted_mortgage_percent"
                name="With mortgage"
                stackId="a"
                fill="#176b55"
              />
              <Bar
                dataKey="weighted_free_and_clear_percent"
                name="Free and clear"
                stackId="a"
                fill="#b06f24"
              />
            </BarChart>
          </ResponsiveContainer>
          <details className="chart-data-table">
            <summary>View chart data</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>State</th>
                    <th>With mortgage</th>
                    <th>Free and clear</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row.state_name)}>
                      <th>{row.state_name}</th>
                      <td>
                        {Number(row.weighted_mortgage_percent).toFixed(1)}%
                      </td>
                      <td>
                        {Number(row.weighted_free_and_clear_percent).toFixed(1)}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      ) : (
        <RoomMatrix rows={rows} />
      )}
    </section>
  );
}

function RoomMatrix({ rows }: { rows: DataRow[] }) {
  const visible = rows.filter(
    (row) => Number(row.record_count) >= 250 && Number(row.bedroom_count) <= 6,
  );
  const values = visible.map((row) => Number(row.weighted_median_value));
  const maximum = Math.max(...values);
  return (
    <article className="workspace-card wide-card">
      <div className="card-heading">
        <div>
          <span>Conditional association</span>
          <h2>Bedrooms, rooms, and weighted median property value</h2>
        </div>
      </div>
      <div className="matrix-grid" aria-label="Bedroom and room value matrix">
        {visible.map((row) => {
          const value = Number(row.weighted_median_value);
          return (
            <div
              key={`${row.room_count}-${row.bedroom_count}`}
              style={
                { '--matrix-strength': value / maximum } as React.CSSProperties
              }
            >
              <strong>
                {row.bedroom_count} bd · {row.room_count} rooms
              </strong>
              <span>{dollars.format(value)}</span>
              <small>n={integer.format(Number(row.record_count))}</small>
            </div>
          );
        })}
      </div>
      <p className="workspace-caveat">
        Cells with fewer than 250 records are suppressed, matching the notebook.
      </p>
    </article>
  );
}

function GeographyMap({
  stateName,
  level,
  selectedId,
  values,
  onSelect,
  onStateDrill,
}: {
  stateName: string;
  level: 'state' | 'county' | 'puma';
  selectedId: string;
  values: Record<string, number>;
  onSelect: (id: string) => void;
  onStateDrill: (state: string) => void;
}) {
  const fips = STATE_FIPS[stateName];
  const geometryPath =
    level === 'state'
      ? '/data/states.geojson'
      : level === 'county'
        ? '/data/county-geometry.geojson'
        : `/data/puma-geometry-${fips}.geojson`;
  const { data, error } = useGeoJson(geometryPath);
  const filtered = useMemo(() => {
    if (!data) return null;
    if (level === 'state') return data;
    return {
      ...data,
      features: data.features.filter(
        (feature) => feature.properties.state_name === stateName,
      ),
    };
  }, [data, level, stateName]);
  const paths = useMemo(() => {
    if (!filtered?.features.length) return [];
    const projection = geoMercator().fitSize([760, 520], filtered as never);
    const path = geoPath(projection);
    return filtered.features.map((feature) => ({
      feature,
      d: path(feature as never) ?? '',
    }));
  }, [filtered]);
  if (!filtered) return <Loading error={error} />;
  const magnitudes = Object.values(values);
  const min = Math.min(...magnitudes, 0);
  const max = Math.max(...magnitudes, 1);
  return (
    <svg
      className="workspace-map"
      viewBox="0 0 760 520"
      aria-label={`${level} map for ${stateName}`}
    >
      {paths.map(({ feature, d }) => {
        const id = String(feature.id);
        const value = values[id];
        const strength =
          value === undefined ? 0 : (value - min) / Math.max(max - min, 0.0001);
        const label =
          feature.properties.county_label ||
          feature.properties.puma_name ||
          feature.properties.state_name;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-label={`${label}${value === undefined ? '' : `, ${dollars.format(value)}`}`}
            onClick={(event) => {
              event.preventDefault();
              if (level === 'state') {
                onStateDrill(feature.properties.state_name);
              } else {
                onSelect(id);
              }
            }}
          >
            <path
              d={d}
              className={
                selectedId === id ? 'geo-boundary selected' : 'geo-boundary'
              }
              style={{
                fill:
                  value === undefined
                    ? '#e5e0d6'
                    : `hsl(161 36% ${82 - strength * 47}%)`,
              }}
            >
              <title>
                {label}
                {value === undefined ? '' : ` · ${dollars.format(value)}`}
              </title>
            </path>
          </a>
        );
      })}
    </svg>
  );
}

function GeographyExplorer({
  stateName,
  level,
  county,
  puma,
  onCounty,
  onPuma,
  onState,
  onLevel,
}: {
  stateName: string;
  level: 'state' | 'county' | 'puma';
  county: string;
  puma: string;
  onCounty: (value: string) => void;
  onPuma: (value: string) => void;
  onState: (value: string) => void;
  onLevel: (value: 'state' | 'county' | 'puma') => void;
}) {
  const { data: eda, error: edaError } = useDataset<EdaData>(
    '/data/housing-eda.json',
  );
  const resultPath =
    level === 'county'
      ? '/data/county-shap.json'
      : level === 'puma'
        ? `/data/puma-shap-${STATE_FIPS[stateName]}.json`
        : '/data/state-shap.json';
  const { data: results, error: resultError } =
    useDataset<GeoResult[]>(resultPath);
  if (!eda || !results) return <Loading error={edaError || resultError} />;
  const countyValues = Object.fromEntries(
    eda.approximate_county_values
      .filter((row) => row.state_name === stateName)
      .map((row) => [
        `${stateName}-${String(row.county_name)}`,
        Number(row.weighted_median_value),
      ]),
  );
  const resultCountyByName = Object.fromEntries(
    results
      .filter((row) => row.county_label)
      .map((row) => [
        `${row.state_name}-${String(row.county_label).replace(/ County$/, '')}`,
        String(row.county_id).padStart(5, '0'),
      ]),
  );
  const values =
    level === 'state'
      ? Object.fromEntries(
          STATES.map((name) => [
            STATE_FIPS[name],
            Number(
              eda.state_year_target.find(
                (row) =>
                  row.state_name === name && Number(row.survey_year) === 2024,
              )?.weighted_median_value_2024 ?? 0,
            ),
          ]),
        )
      : level === 'county'
        ? Object.fromEntries(
            Object.entries(countyValues)
              .map(([key, value]) => [resultCountyByName[key], value])
              .filter(([id]) => id),
          )
        : Object.fromEntries(
            eda.puma_values
              .filter((row) =>
                String(row.puma_geoid)
                  .padStart(7, '0')
                  .startsWith(STATE_FIPS[stateName]),
              )
              .map((row) => {
                const geoid = String(row.puma_geoid).padStart(7, '0');
                return [
                  `${geoid.slice(0, 2)}_${geoid.slice(2)}`,
                  Number(row.weighted_median_value),
                ];
              }),
          );
  const selectedId =
    level === 'county'
      ? county
      : level === 'puma'
        ? puma
        : STATE_FIPS[stateName];
  const selected =
    level === 'state'
      ? results.find((row) => row.state_name === stateName)
      : level === 'county'
        ? results.find(
            (row) => String(row.county_id).padStart(5, '0') === county,
          )
        : results.find((row) => row.state_puma_id === puma);
  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Geography explorer</p>
          <h1>Move from study area to modeled geography</h1>
        </div>
        <p>
          Click a state to zoom into approximate counties, then switch to
          State–PUMA for the geography used directly by the model.
        </p>
      </div>
      <div className="geo-layout">
        <article className="workspace-card map-card">
          <div className="map-actions">
            <div>
              <strong>
                {level === 'state'
                  ? 'Five-state study area'
                  : `${stateName} · ${level === 'county' ? 'approximate counties' : 'State–PUMAs'}`}
              </strong>
              <small>Fill shows survey-weighted median reported value</small>
            </div>
            <button onClick={() => onLevel('state')}>Reset map</button>
          </div>
          <GeographyMap
            stateName={stateName}
            level={level}
            selectedId={selectedId}
            values={values}
            onSelect={level === 'county' ? onCounty : onPuma}
            onStateDrill={(name) => {
              onState(name);
              onLevel('county');
            }}
          />
        </article>
        <GeoDetail result={selected} medianValue={values[selectedId]} />
      </div>
    </section>
  );
}

function GeoDetail({
  result,
  medianValue,
}: {
  result?: GeoResult;
  medianValue?: number;
}) {
  if (!result)
    return (
      <aside className="workspace-detail">
        <p className="eyebrow">Selection</p>
        <h2>Select a boundary</h2>
        <p>
          Choose a visible geography to inspect its support and leading model
          drivers.
        </p>
      </aside>
    );
  const label =
    result.county_label || result.state_puma_id || result.state_name;
  return (
    <aside className="workspace-detail">
      <p className="eyebrow">Selected geography</p>
      <h2>{label}</h2>
      <dl>
        {medianValue ? (
          <div>
            <dt>Weighted median value</dt>
            <dd>{dollars.format(medianValue)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Records</dt>
          <dd>{integer.format(result.records)}</dd>
        </div>
        <div>
          <dt>Effective sample size</dt>
          <dd>{integer.format(Math.round(result.effective_sample_size))}</dd>
        </div>
        {result.reliability ? (
          <div>
            <dt>Reliability</dt>
            <dd>
              <span
                className={`reliability-label ${result.reliability.toLowerCase().replaceAll(' ', '-')}`}
              >
                {result.reliability}
              </span>
            </dd>
          </div>
        ) : null}
        {result.median_PUMA_county_overlap_pct !== undefined ? (
          <div>
            <dt>Median overlap</dt>
            <dd>{result.median_PUMA_county_overlap_pct.toFixed(1)}%</dd>
          </div>
        ) : null}
        {result.records_with_overlap_at_least_80_pct !== undefined ? (
          <div>
            <dt>Records ≥80% overlap</dt>
            <dd>{result.records_with_overlap_at_least_80_pct.toFixed(1)}%</dd>
          </div>
        ) : null}
      </dl>
      <h3>Leading non-geographic drivers</h3>
      <ol>
        {result.top_non_geographic_features.map((feature) => (
          <li key={feature.feature}>
            <span>{feature.rank}</span>
            <strong>{humanize(feature.feature)}</strong>
            <small>{feature.importance.toFixed(3)}</small>
          </li>
        ))}
      </ol>
      {result.county_label ? (
        <p className="workspace-caveat">
          County assignment is descriptive and approximate, based on the
          dominant PUMA–county boundary overlap.
        </p>
      ) : (
        <p className="workspace-caveat">
          State–PUMA is the geographic feature entered directly into the model.
        </p>
      )}
    </aside>
  );
}

function CompareExplorer({
  stateName,
  level,
  comparison,
  onComparison,
}: {
  stateName: string;
  level: 'state' | 'county' | 'puma';
  comparison: string;
  onComparison: (value: string) => void;
}) {
  const path =
    level === 'county'
      ? '/data/county-shap.json'
      : level === 'puma'
        ? `/data/puma-shap-${STATE_FIPS[stateName]}.json`
        : '/data/state-shap.json';
  const { data, error } = useDataset<GeoResult[]>(path);
  const { data: stateResults, error: stateError } = useDataset<GeoResult[]>(
    '/data/state-shap.json',
  );
  const [left, setLeft] = useState('');
  if (!data || !stateResults) return <Loading error={error || stateError} />;
  const scoped = data.filter(
    (row) => level === 'state' || row.state_name === stateName,
  );
  const id = (row: GeoResult) =>
    row.county_id
      ? String(row.county_id).padStart(5, '0')
      : row.state_puma_id || row.state_name;
  const label = (row: GeoResult) =>
    row.county_label || row.state_puma_id || row.state_name;
  const leftRow = scoped.find((row) => id(row) === left) ?? scoped[0];
  const rightRow =
    scoped.find((row) => id(row) === comparison) ?? scoped[1] ?? scoped[0];
  const parentState = stateResults.find((row) => row.state_name === stateName);
  const features = Array.from(
    new Set(
      [
        ...leftRow.top_non_geographic_features,
        ...rightRow.top_non_geographic_features,
      ].map((item) => item.feature),
    ),
  );
  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Comparison mode</p>
          <h1>Place two geographic explanations side by side</h1>
        </div>
        <p>
          Compare like with like: state to state, approximate county to
          approximate county, or State–PUMA to State–PUMA.
        </p>
      </div>
      <div className="compare-selectors">
        {[
          { value: id(leftRow), set: setLeft, title: 'Geography A' },
          {
            value: id(rightRow),
            set: onComparison,
            title: 'Geography B',
          },
        ].map((control) => (
          <label key={control.title}>
            {control.title}
            <select
              value={control.value}
              onChange={(event) => control.set(event.target.value)}
            >
              {scoped.map((row) => (
                <option key={id(row)} value={id(row)}>
                  {label(row)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <article className="workspace-card comparison-table-card">
        <table>
          <thead>
            <tr>
              <th>Non-geographic feature</th>
              <th>{label(leftRow)} importance</th>
              <th>{label(rightRow)} importance</th>
              <th>Difference</th>
              {level !== 'state' ? <th>{stateName} importance</th> : null}
              {level !== 'state' ? <th>A vs. parent state</th> : null}
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => {
              const a = leftRow.feature_importance[feature] ?? 0;
              const b = rightRow.feature_importance[feature] ?? 0;
              return (
                <tr key={feature}>
                  <th>{humanize(feature)}</th>
                  <td>{a.toFixed(3)}</td>
                  <td>{b.toFixed(3)}</td>
                  <td className={a - b >= 0 ? 'positive' : 'negative'}>
                    {(a - b).toFixed(3)}
                  </td>
                  {level !== 'state' ? (
                    <td>
                      {(parentState?.feature_importance[feature] ?? 0).toFixed(
                        3,
                      )}
                    </td>
                  ) : null}
                  {level !== 'state' ? (
                    <td
                      className={
                        a - (parentState?.feature_importance[feature] ?? 0) >= 0
                          ? 'positive'
                          : 'negative'
                      }
                    >
                      {(
                        a - (parentState?.feature_importance[feature] ?? 0)
                      ).toFixed(3)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
      <p className="workspace-caveat">
        Mean absolute SHAP compares model reliance, not causal effects. County
        comparisons inherit dominant-overlap uncertainty.
      </p>
    </section>
  );
}

function DriversExplorer({
  stateName,
  featureId,
  metric,
  features,
}: {
  stateName: string;
  featureId: string;
  metric: 'importance' | 'direction';
  features: Feature[];
}) {
  const [geographicLevel, setGeographicLevel] = useState<'county' | 'puma'>(
    'county',
  );
  const { data: global, error: globalError } = useDataset<GlobalShap[]>(
    '/data/global-shap.json',
  );
  const { data: states, error: stateError } = useDataset<GeoResult[]>(
    '/data/state-shap.json',
  );
  const { data: dependence, error: dependenceError } = useDataset<Dependence[]>(
    '/data/shap-dependence.json',
  );
  const { data: geographic, error: geographicError } = useDataset<GeoResult[]>(
    geographicLevel === 'county'
      ? '/data/county-shap.json'
      : `/data/puma-shap-${STATE_FIPS[stateName]}.json`,
  );
  if (!global || !states || !dependence || !geographic)
    return (
      <Loading
        error={globalError || stateError || dependenceError || geographicError}
      />
    );
  const metadata =
    features.find((item) => item.feature === featureId) ?? features[0];
  const stateRows = states.map((state) => ({
    state: state.state_name,
    value:
      metric === 'importance'
        ? state.feature_importance[featureId]
        : state.feature_direction[featureId],
  }));
  const dependenceRows = dependence.filter((row) => row.feature === featureId);
  const geographicRows = geographic
    .filter((row) => row.state_name === stateName)
    .map((row) => ({
      id: row.county_label || row.state_puma_id || row.state_name,
      value:
        metric === 'importance'
          ? row.feature_importance[featureId]
          : row.feature_direction[featureId],
      reliability: row.reliability,
    }))
    .sort((a, b) =>
      metric === 'importance'
        ? b.value - a.value
        : Math.abs(b.value) - Math.abs(a.value),
    )
    .slice(0, 10);
  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Feature explorer · TreeSHAP</p>
          <h1>{metadata.display_name}</h1>
        </div>
        <p>
          {metadata.description} Importance measures magnitude; average
          direction measures whether contributions were upward or downward on
          average.
        </p>
      </div>
      <article className="workspace-card wide-card global-driver-card">
        <div className="card-heading">
          <div>
            <span>Global importance · survey weighted</span>
            <h2>Which features shape predictions across the full study?</h2>
          </div>
          <small>Mean absolute SHAP · log1p units</small>
        </div>
        <div className="global-driver-list">
          {global.map((item, index) => (
            <div key={item.feature}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{humanize(item.feature)}</strong>
              <i>
                <b
                  style={{
                    width: `${(item.survey_weighted_mean_absolute_SHAP / global[0].survey_weighted_mean_absolute_SHAP) * 100}%`,
                  }}
                />
              </i>
              <small>
                {item.survey_weighted_mean_absolute_SHAP.toFixed(3)}
              </small>
            </div>
          ))}
        </div>
        <p className="workspace-caveat">
          State–PUMA is the model’s direct geographic feature. Select a
          substantive feature above to inspect its state, county, PUMA, and
          dependence patterns.
        </p>
      </article>
      <article className="workspace-card wide-card geographic-feature-card">
        <div className="card-heading">
          <div>
            <span>Within {stateName}</span>
            <h2>Where is this feature most prominent in the model?</h2>
          </div>
          <fieldset
            className="mini-switch"
            aria-label="Geographic feature level"
          >
            <button
              aria-pressed={geographicLevel === 'county'}
              onClick={() => setGeographicLevel('county')}
            >
              Approximate county
            </button>
            <button
              aria-pressed={geographicLevel === 'puma'}
              onClick={() => setGeographicLevel('puma')}
            >
              State–PUMA
            </button>
          </fieldset>
        </div>
        <div className="geographic-feature-list">
          {geographicRows.map((row, index) => (
            <div key={row.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{row.id}</strong>
              {row.reliability ? (
                <small>{row.reliability}</small>
              ) : (
                <small>Modeled geography</small>
              )}
              <b className={row.value >= 0 ? 'positive' : 'negative'}>
                {row.value.toFixed(3)}
              </b>
            </div>
          ))}
        </div>
        <p className="workspace-caveat">
          County results are descriptive approximations. State–PUMA is the
          geography entered directly into the fitted model.
        </p>
      </article>
      <div className="driver-grid">
        <article className="workspace-card">
          <div className="card-heading">
            <div>
              <span>
                {metric === 'importance' ? 'Mean |SHAP|' : 'Mean signed SHAP'}
              </span>
              <h2>How does model reliance vary by state?</h2>
            </div>
            <strong>{stateName}</strong>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart
              data={stateRows}
              margin={{ left: 14, right: 18, bottom: 40 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="#ded8cb"
                strokeDasharray="2 4"
              />
              <XAxis dataKey="state" angle={-20} textAnchor="end" height={65} />
              <YAxis />
              <Tooltip formatter={(value) => Number(value).toFixed(4)} />
              <Bar
                dataKey="value"
                name={
                  metric === 'importance' ? 'Importance' : 'Average direction'
                }
                fill={metric === 'importance' ? '#176b55' : '#a14f43'}
              />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="workspace-detail feature-detail">
          <p className="eyebrow">Technical metadata</p>
          <h2>{metadata.display_name}</h2>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>{metadata.ACS_source}</dd>
            </div>
            <div>
              <dt>Semantic type</dt>
              <dd>{metadata.semantic_type}</dd>
            </div>
            <div>
              <dt>Encoding</dt>
              <dd>{metadata.transformation_and_encoding}</dd>
            </div>
            <div>
              <dt>Missing values</dt>
              <dd>{metadata.remaining_missing_handling}</dd>
            </div>
            <div>
              <dt>Global importance</dt>
              <dd>
                {global
                  .find((item) => item.feature === featureId)
                  ?.survey_weighted_mean_absolute_SHAP.toFixed(3) ?? '—'}
              </dd>
            </div>
          </dl>
        </article>
      </div>
      {dependenceRows.length ? (
        <article className="workspace-card wide-card dependence-card">
          <div className="card-heading">
            <div>
              <span>Direction and shape</span>
              <h2>
                How do binned feature values relate to model contribution?
              </h2>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart
              data={dependenceRows}
              margin={{ left: 20, right: 20, bottom: 80 }}
            >
              <CartesianGrid stroke="#ded8cb" strokeDasharray="2 4" />
              <XAxis
                dataKey="feature_bin"
                angle={-28}
                textAnchor="end"
                height={105}
                interval={0}
                tick={{ fontSize: 10 }}
              />
              <YAxis />
              <Tooltip formatter={(value) => Number(value).toFixed(3)} />
              <Line
                dataKey="weighted_mean_SHAP"
                name="Mean signed SHAP"
                stroke="#176b55"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>
      ) : (
        <div className="workspace-empty">
          A saved dependence table is not available for this feature. Importance
          and state direction remain available.
        </div>
      )}
      <p className="workspace-caveat">
        SHAP explains the fitted model’s predictions in log1p property-value
        units. It does not identify causes or dollar effects.
      </p>
    </section>
  );
}

function ModelExplorer() {
  const { data: models, error: modelError } = useDataset<ModelResult[]>(
    '/data/model-performance.json',
  );
  const { data: diagnostics, error: diagnosticError } =
    useDataset<DiagnosticData>('/data/model-diagnostics.json');
  const [metric, setMetric] = useState<'MAE' | 'RMSE' | 'R_squared'>('MAE');
  if (!models || !diagnostics)
    return <Loading error={modelError || diagnosticError} />;
  const chart = diagnostics.cv_folds.map((row) => ({
    ...row,
    value: Number(row[metric]),
  }));
  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Model evaluation</p>
          <h1>Compare prediction error before explanation</h1>
        </div>
        <p>
          Candidate models were compared on 2020–2023 development folds. The
          selected reduced XGBoost was then evaluated once on 2024.
        </p>
      </div>
      <fieldset className="metric-switch" aria-label="Evaluation metric">
        {(['MAE', 'RMSE', 'R_squared'] as const).map((name) => (
          <button
            key={name}
            aria-pressed={metric === name}
            onClick={() => setMetric(name)}
          >
            {name === 'R_squared' ? 'R²' : name}
          </button>
        ))}
      </fieldset>
      <article className="workspace-card wide-card model-evaluation-table">
        <table>
          <thead>
            <tr>
              <th>Candidate model</th>
              <th>Mean CV MAE</th>
              <th>95% CV interval</th>
              <th>Mean CV RMSE</th>
              <th>Mean CV R²</th>
              <th>2024 MAE</th>
              <th>2024 R²</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => {
              const selected = Boolean(
                model.cross_validation.selected_for_SHAP,
              );
              return (
                <tr
                  key={model.model}
                  className={selected ? 'selected-model-row' : ''}
                >
                  <th>
                    {model.model}
                    {selected ? <small>Selected for SHAP</small> : null}
                  </th>
                  <td>
                    {dollars.format(Number(model.cross_validation.mean_CV_MAE))}
                  </td>
                  <td>
                    {dollars.format(
                      Number(model.cross_validation.lower_95_CV_MAE),
                    )}
                    –
                    {dollars.format(
                      Number(model.cross_validation.upper_95_CV_MAE),
                    )}
                  </td>
                  <td>
                    {dollars.format(
                      Number(model.cross_validation.mean_CV_RMSE),
                    )}
                  </td>
                  <td>
                    {Number(model.cross_validation.mean_CV_R_squared).toFixed(
                      3,
                    )}
                  </td>
                  <td>
                    {dollars.format(Number(model.temporal_2024.test_MAE))}
                  </td>
                  <td>
                    {Number(model.temporal_2024.test_R_squared).toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
      <article className="workspace-card wide-card">
        <div className="card-heading">
          <div>
            <span>Cross-validation folds</span>
            <h2>How stable was each candidate across development folds?</h2>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={390}>
          <LineChart data={chart} margin={{ left: 28, right: 30, bottom: 85 }}>
            <CartesianGrid stroke="#ded8cb" strokeDasharray="2 4" />
            <XAxis
              dataKey="model"
              angle={-30}
              textAnchor="end"
              height={110}
              interval={0}
              tick={{ fontSize: 9 }}
            />
            <YAxis
              domain={metric === 'R_squared' ? [0, 0.5] : ['auto', 'auto']}
              tickFormatter={(value) =>
                metric === 'R_squared'
                  ? Number(value).toFixed(2)
                  : `$${Math.round(Number(value) / 1000)}k`
              }
            />
            <Tooltip
              formatter={(value) =>
                metric === 'R_squared'
                  ? Number(value).toFixed(3)
                  : dollars.format(Number(value))
              }
            />
            <Line dataKey="value" stroke="#176b55" dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </article>
      <div className="model-progression">
        <article>
          <span>01</span>
          <h3>Baselines</h3>
          <p>
            Naive, linear, and regularized references established the error
            scale.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Tree candidates</h3>
          <p>
            Random Forest, XGBoost, and CatBoost captured nonlinear
            interactions.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Development reduction</h3>
          <p>
            Permutation evidence produced the 18-feature reduced specification.
          </p>
        </article>
        <article>
          <span>04</span>
          <h3>Temporal evaluation</h3>
          <p>All eligible 2024 records tested short-horizon generalization.</p>
        </article>
      </div>
    </section>
  );
}

function DiagnosticsExplorer() {
  const { data, error } = useDataset<DiagnosticData>(
    '/data/model-diagnostics.json',
  );
  if (!data) return <Loading error={error} />;
  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h1>Inspect measurement and explanation stability</h1>
        </div>
        <p>
          Only completed notebook and publication-readiness outputs are shown.
          These diagnostics do not add new analyses.
        </p>
      </div>
      <div className="diagnostic-grid">
        <article className="workspace-card">
          <div className="card-heading">
            <div>
              <span>Target audit</span>
              <h2>Top-coding and allocation by state/year</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Year</th>
                  <th>Median</th>
                  <th>Allocated</th>
                  <th>Top-coded</th>
                </tr>
              </thead>
              <tbody>
                {data.target_measurement.map((row) => (
                  <tr key={`${row.state_name}-${row.survey_year}`}>
                    <th>{row.state_name}</th>
                    <td>{row.survey_year}</td>
                    <td>
                      {dollars.format(Number(row.weighted_median_value_2024))}
                    </td>
                    <td>{Number(row.allocated_target_pct).toFixed(1)}%</td>
                    <td>{Number(row.official_topcoded_pct).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="workspace-card">
          <div className="card-heading">
            <div>
              <span>Bootstrap stability</span>
              <h2>State ranking agreement</h2>
            </div>
          </div>
          <div className="stability-list">
            {data.state_stability.map((row) => (
              <div key={String(row.state_name)}>
                <strong>{row.state_name}</strong>
                <span>
                  {Number(row.leading_feature_agreement_pct).toFixed(0)}%
                  leading-feature agreement
                </span>
                <meter
                  min="0"
                  max="100"
                  value={Number(row.mean_top_five_overlap_pct)}
                >
                  {row.mean_top_five_overlap_pct}%
                </meter>
                <small>
                  {Number(row.mean_top_five_overlap_pct).toFixed(1)}% mean
                  top-five overlap
                </small>
              </div>
            ))}
          </div>
        </article>
      </div>
      <p className="workspace-caveat">
        The stability analysis is a record bootstrap, not an ACS
        successive-difference-replication margin of error.
      </p>
    </section>
  );
}

function MethodologyExplorer({ features }: { features: Feature[] }) {
  return (
    <section className="workspace-module methodology-module">
      <div className="module-heading">
        <div>
          <p className="eyebrow">Methodology</p>
          <h1>From ACS records to geographic explanations</h1>
        </div>
        <p>
          This workspace presents completed outputs; it never trains the model
          or ships raw microdata to the browser.
        </p>
      </div>
      <div className="method-flow">
        <article>
          <span>01</span>
          <h2>Cohort</h2>
          <p>Owner-occupied one-family housing records across five states.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Development</h2>
          <p>
            2020–2023 preprocessing, tuning, feature reduction, and five-fold
            CV.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Evaluation</h2>
          <p>
            Untouched 2024 temporal assessment using MAE, RMSE, R², and
            relative-error shares.
          </p>
        </article>
        <article>
          <span>04</span>
          <h2>Explanation</h2>
          <p>
            Exact TreeSHAP on 268,930 2024 records, aggregated with housing-unit
            weights.
          </p>
        </article>
      </div>
      <article className="workspace-card wide-card">
        <div className="card-heading">
          <div>
            <span>Selected specification</span>
            <h2>18 semantic features with explicit encodings</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Domain</th>
                <th>Type</th>
                <th>Transformation / encoding</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.feature}>
                  <th>
                    {feature.display_name}
                    <small>{feature.feature}</small>
                  </th>
                  <td>{feature.category}</td>
                  <td>{feature.semantic_type}</td>
                  <td>{feature.transformation_and_encoding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <div className="limitations-panel">
        <h2>Interpretation boundaries</h2>
        <p>
          VALP is an owner estimate, not a sale price. It is reported, rounded,
          allocated for some records, and state/year-specific top-coded.
        </p>
        <p>
          SHAP values explain predictions rather than causes. County summaries
          are approximate post-model aggregations based on dominant PUMA
          overlap.
        </p>
        <p>
          The five-state design and short-horizon 2024 evaluation do not support
          nationwide or long-run generalization.
        </p>
      </div>
    </section>
  );
}

function humanize(feature: string) {
  const labels: Record<string, string> = {
    first_mortgage_log_2024: 'First mortgage payment',
    signed_log_household_income_2024: 'Household income',
    year_built_order: 'Year built',
    bedroom_count: 'Bedrooms',
    non_bedroom_rooms: 'Other rooms',
    household_size: 'Household size',
    lot_size_order: 'Lot size',
    electricity_log_2024: 'Electricity cost',
    gas_log_2024: 'Gas cost',
    water_sewer_log_2024: 'Water and sewer cost',
    household_type: 'Household type',
    year_moved_order: 'Year moved in',
    heating_fuel: 'Heating fuel',
    structure_type: 'Structure type',
    hoa_fee_log_2024: 'Condo or HOA fee',
    other_fuel_log_2024: 'Other fuel cost',
    survey_year: 'Survey year',
    state_puma: 'State–PUMA',
  };
  return labels[feature] ?? feature.replaceAll('_', ' ');
}

export function AnalysisWorkspace({
  scope = 'explore',
}: {
  scope?: WorkspaceScope;
}) {
  const availableModules = scopedModules[scope];
  const [state, dispatch] = useReducer(
    workspaceReducer,
    defaultWorkspaceState,
    (initial) => {
      const parsed =
        typeof window === 'undefined'
          ? initial
          : parseWorkspaceQuery(new URLSearchParams(window.location.search));
      return {
        ...parsed,
        module: availableModules.includes(parsed.module)
          ? parsed.module
          : availableModules[0],
      };
    },
  );
  const { data: features, error: featureError } = useDataset<Feature[]>(
    '/data/feature-metadata.json',
  );
  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${serializeWorkspaceQuery(state)}`,
    );
  }, [state]);
  if (!features) return <Loading error={featureError} />;
  return (
    <div className="analysis-workspace">
      <div className="workspace-stage">
        <WorkspaceContext
          scope={scope}
          module={state.module}
          stateName={state.state}
          level={state.level}
          feature={state.feature}
          metric={state.metric}
          features={features}
          onState={(value) => dispatch({ type: 'set-state', value })}
          onLevel={(value) => dispatch({ type: 'set-level', value })}
          onFeature={(value) => dispatch({ type: 'set-feature', value })}
          onMetric={(value) => dispatch({ type: 'set-metric', value })}
        />
        <div className="workspace-canvas" id="workspace-main">
          {availableModules.length > 1 ? (
            <nav
              className="workspace-section-tabs"
              aria-label={`${scope} views`}
            >
              {availableModules.map((module) => (
                <button
                  key={module}
                  aria-current={state.module === module ? 'page' : undefined}
                  onClick={() =>
                    dispatch({ type: 'set-module', value: module })
                  }
                >
                  {moduleLabels[module]}
                </button>
              ))}
            </nav>
          ) : null}
          {state.module === 'housing' ? (
            <HousingExplorer stateName={state.state} />
          ) : null}
          {state.module === 'geography' ? (
            <GeographyExplorer
              stateName={state.state}
              level={state.level}
              county={state.county}
              puma={state.puma}
              onCounty={(value) => dispatch({ type: 'set-county', value })}
              onPuma={(value) => dispatch({ type: 'set-puma', value })}
              onState={(value) => dispatch({ type: 'set-state', value })}
              onLevel={(value) => dispatch({ type: 'set-level', value })}
            />
          ) : null}
          {state.module === 'compare' ? (
            <CompareExplorer
              key={`${state.state}-${state.level}`}
              stateName={state.state}
              level={state.level}
              comparison={state.comparison}
              onComparison={(value) =>
                dispatch({ type: 'set-comparison', value })
              }
            />
          ) : null}
          {state.module === 'drivers' ? (
            <DriversExplorer
              stateName={state.state}
              featureId={state.feature}
              metric={state.metric}
              features={features}
            />
          ) : null}
          {state.module === 'models' ? <ModelExplorer /> : null}
          {state.module === 'diagnostics' ? <DiagnosticsExplorer /> : null}
          {state.module === 'methodology' ? (
            <MethodologyExplorer features={features} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
