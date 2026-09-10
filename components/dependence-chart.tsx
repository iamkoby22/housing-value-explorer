'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DependenceDatum = {
  feature: string;
  feature_bin: string;
  weighted_mean_feature_value: number;
  weighted_mean_SHAP: number;
  lower_95_SHAP: number;
  upper_95_SHAP: number;
  records: number;
};

export function DependenceChart({
  data,
  options,
}: {
  data: DependenceDatum[];
  options: { id: string; label: string }[];
}) {
  const [feature, setFeature] = useState(options[0].id);
  const selected = useMemo(
    () => data.filter((datum) => datum.feature === feature),
    [data, feature],
  );
  const activeLabel =
    options.find((option) => option.id === feature)?.label ?? feature;

  return (
    <div className="chart-shell">
      <label className="select-label">
        Feature
        <select
          value={feature}
          onChange={(event) => setFeature(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <figure
        className="chart-frame"
        aria-label={`Binned SHAP dependence for ${activeLabel}`}
      >
        <ResponsiveContainer width="100%" height={360}>
          <LineChart
            data={selected}
            margin={{ top: 18, right: 24, bottom: 46, left: 16 }}
          >
            <CartesianGrid stroke="#ddd7ca" strokeDasharray="2 4" />
            <XAxis
              dataKey="feature_bin"
              angle={-28}
              textAnchor="end"
              height={86}
              interval="preserveStartEnd"
              tick={{ fill: '#626b66', fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: '#626b66', fontSize: 12 }}
              label={{
                value: 'Mean SHAP',
                angle: -90,
                position: 'insideLeft',
                fill: '#626b66',
              }}
            />
            <ReferenceLine y={0} stroke="#18201d" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]?.payload) return null;
                const item = payload[0].payload as DependenceDatum;
                return (
                  <div className="chart-tooltip">
                    <strong>{item.feature_bin}</strong>
                    <span>Mean SHAP {item.weighted_mean_SHAP.toFixed(3)}</span>
                    <span>{item.records.toLocaleString()} records</span>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="weighted_mean_SHAP"
              stroke="#176b55"
              strokeWidth={2.5}
              dot={{ fill: '#fffdf8', stroke: '#176b55', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </figure>
      <p className="figure-note">
        Binned, survey-weighted 2024 TreeSHAP. The curve describes the fitted
        model’s association, not the effect of changing the feature.
      </p>
    </div>
  );
}
