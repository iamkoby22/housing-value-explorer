'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ImportanceDatum = {
  feature: string;
  value: number;
  label: string;
  category?: string;
};

export function ImportanceChart({
  data,
  allowGeographyToggle = false,
  limit = 10,
}: {
  data: ImportanceDatum[];
  allowGeographyToggle?: boolean;
  limit?: number;
}) {
  const [includeGeography, setIncludeGeography] = useState(true);
  const chartData = useMemo(
    () =>
      data
        .filter((datum) => includeGeography || datum.feature !== 'state_puma')
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
        .reverse(),
    [data, includeGeography, limit],
  );

  return (
    <div className="chart-shell">
      {allowGeographyToggle ? (
        <fieldset className="segmented-control" aria-label="Feature scope">
          <button
            aria-pressed={includeGeography}
            onClick={() => setIncludeGeography(true)}
          >
            All features
          </button>
          <button
            aria-pressed={!includeGeography}
            onClick={() => setIncludeGeography(false)}
          >
            Non-geographic
          </button>
        </fieldset>
      ) : null}
      <figure
        className="chart-frame"
        aria-label="Ranked survey-weighted mean absolute SHAP values"
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(360, chartData.length * 42)}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 30, bottom: 30, left: 10 }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="#ddd7ca"
              strokeDasharray="2 4"
            />
            <XAxis
              type="number"
              tick={{ fill: '#626b66', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Mean |SHAP| · log1p value units',
                position: 'insideBottom',
                offset: -18,
                fill: '#626b66',
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={165}
              tick={{ fill: '#18201d', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#efeade' }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]?.payload) return null;
                const item = payload[0].payload as ImportanceDatum;
                return (
                  <div className="chart-tooltip">
                    <strong>{item.label}</strong>
                    <span>Mean |SHAP| {item.value.toFixed(3)}</span>
                    <small>Predictive contribution, not causal effect</small>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              fill="#176b55"
              radius={[0, 3, 3, 0]}
              animationDuration={350}
            />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <p className="figure-note">
        Survey-weighted mean absolute TreeSHAP for 2024 records. Larger values
        mean the selected model relied more on the feature; units are not
        dollars.
      </p>
    </div>
  );
}
