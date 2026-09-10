'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { dollars } from '@/lib/format';

type ModelDatum = {
  model: string;
  cvMae: number;
  testMae: number;
  selected: boolean;
};

export function ModelComparison({ data }: { data: ModelDatum[] }) {
  return (
    <div className="chart-shell">
      <figure
        className="chart-frame"
        aria-label="Development cross-validation and 2024 temporal mean absolute error by model"
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={data}
            margin={{ top: 16, right: 12, bottom: 64, left: 12 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#ddd7ca"
              strokeDasharray="2 4"
            />
            <XAxis
              dataKey="model"
              angle={-25}
              textAnchor="end"
              interval={0}
              height={78}
              tick={{ fill: '#626b66', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              tick={{ fill: '#626b66', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => dollars.format(Number(value))}
              contentStyle={{
                background: '#fffdf8',
                border: '1px solid #d8d2c5',
                borderRadius: 4,
              }}
            />
            <Bar
              dataKey="cvMae"
              name="2020–2023 mean CV MAE"
              fill="#176b55"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="testMae"
              name="2024 temporal MAE"
              fill="#b06f24"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <div className="legend-row" aria-label="Chart legend">
        <span>
          <i className="legend-swatch green" />
          2020–2023 mean CV MAE
        </span>
        <span>
          <i className="legend-swatch ochre" />
          2024 temporal MAE
        </span>
      </div>
    </div>
  );
}
