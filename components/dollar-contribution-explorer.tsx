'use client';

import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

import { allocateShapToDollars, type ValuationResult } from '@/lib/valuation';

type ContributionScope = 'all' | 'home' | 'household' | 'context';
type ContributionSort = 'impact' | 'model';

const FEATURE_GROUPS: Record<string, Exclude<ContributionScope, 'all'>> = {
  bedroom_count: 'home',
  non_bedroom_rooms: 'home',
  lot_size_order: 'home',
  year_built_order: 'home',
  structure_type: 'home',
  heating_fuel: 'home',
  signed_log_household_income_2024: 'household',
  household_size: 'household',
  year_moved_order: 'household',
  first_mortgage_log_2024: 'household',
  hoa_fee_log_2024: 'household',
  electricity_log_2024: 'household',
  gas_log_2024: 'household',
  other_fuel_log_2024: 'household',
  water_sewer_log_2024: 'household',
  household_type: 'household',
  survey_year: 'context',
  state_puma: 'context',
};

const scopeOptions: Array<{ value: ContributionScope; label: string }> = [
  { value: 'all', label: 'All features' },
  { value: 'home', label: 'Home' },
  { value: 'household', label: 'Household & costs' },
  { value: 'context', label: 'Geography & time' },
];

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function signedDollars(value: number, compact = false) {
  const formatter = compact ? compactDollars : dollars;
  return `${value >= 0 ? '+' : '−'}${formatter.format(Math.abs(value))}`;
}

function groupLabel(feature: string) {
  const group = FEATURE_GROUPS[feature];
  if (group === 'home') return 'Home characteristic';
  if (group === 'context') return 'Geography or time';
  return 'Household or housing cost';
}

export function DollarContributionExplorer({
  result,
  featureValues,
}: {
  result: ValuationResult;
  featureValues: Record<string, string>;
}) {
  const [scope, setScope] = useState<ContributionScope>('all');
  const [sort, setSort] = useState<ContributionSort>('impact');
  const [selectedFeature, setSelectedFeature] = useState(
    result.shap[0]?.feature ?? '',
  );

  const contributions = useMemo(() => allocateShapToDollars(result), [result]);
  const visible = useMemo(() => {
    const scoped =
      scope === 'all'
        ? contributions
        : contributions.filter(
            (item) => FEATURE_GROUPS[item.feature] === scope,
          );
    return [...scoped].sort((left, right) =>
      sort === 'impact'
        ? Math.abs(right.dollars) - Math.abs(left.dollars)
        : left.rank - right.rank,
    );
  }, [contributions, scope, sort]);
  const selected =
    visible.find((item) => item.feature === selectedFeature) ?? visible[0];
  const maximum = Math.max(...visible.map((item) => Math.abs(item.dollars)), 1);
  const netContribution = contributions.reduce(
    (sum, item) => sum + item.dollars,
    0,
  );
  const positiveTotal = contributions.reduce(
    (sum, item) => sum + Math.max(item.dollars, 0),
    0,
  );
  const negativeTotal = contributions.reduce(
    (sum, item) => sum + Math.min(item.dollars, 0),
    0,
  );

  return (
    <article className="result-card dollar-contribution-card">
      <div className="result-card-heading contribution-heading">
        <div>
          <span>02A · Dollar contribution explorer</span>
          <h3>How the entered profile builds the estimate</h3>
        </div>
        <div className="contribution-totals" aria-label="Contribution totals">
          <span>
            Higher <strong>{signedDollars(positiveTotal, true)}</strong>
          </span>
          <span>
            Lower <strong>{signedDollars(negativeTotal, true)}</strong>
          </span>
        </div>
      </div>

      <div
        className="contribution-equation"
        aria-label="Dollar estimate bridge"
      >
        <div>
          <span>Model baseline</span>
          <strong>
            {dollars.format(result.baseline_dollars_for_orientation)}
          </strong>
        </div>
        <b>+</b>
        <div>
          <span>Net feature allocation</span>
          <strong>{signedDollars(netContribution)}</strong>
        </div>
        <b>=</b>
        <div>
          <span>Your estimate</span>
          <strong>{dollars.format(result.estimate)}</strong>
        </div>
      </div>

      <div className="contribution-toolbar">
        <div aria-label="Feature group" className="contribution-filter">
          {scopeOptions.map((option) => (
            <button
              aria-pressed={scope === option.value}
              key={option.value}
              onClick={() => setScope(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as ContributionSort)
            }
          >
            <option value="impact">Largest dollar impact</option>
            <option value="model">Model rank</option>
          </select>
        </label>
      </div>

      <div className="contribution-explorer">
        <div
          className="contribution-chart"
          aria-label="Feature dollar allocations"
        >
          <div className="contribution-axis" aria-hidden="true">
            <span>Pushes lower</span>
            <i />
            <span>Pushes higher</span>
          </div>
          {visible.map((item) => {
            const width = Math.max((Math.abs(item.dollars) / maximum) * 48, 1);
            const positive = item.dollars >= 0;
            return (
              <button
                aria-pressed={selected?.feature === item.feature}
                className="contribution-row"
                key={item.feature}
                onClick={() => setSelectedFeature(item.feature)}
                onFocus={() => setSelectedFeature(item.feature)}
                onMouseEnter={() => setSelectedFeature(item.feature)}
                type="button"
              >
                <span className="contribution-label">
                  <strong>{item.label}</strong>
                  <small>
                    {featureValues[item.feature] ?? 'Model-derived value'}
                  </small>
                </span>
                <span className="contribution-plot" aria-hidden="true">
                  <i className="contribution-zero" />
                  <b
                    className={positive ? 'is-positive' : 'is-negative'}
                    style={{
                      left: positive ? '50%' : `${50 - width}%`,
                      width: `${width}%`,
                    }}
                  />
                </span>
                <strong className={positive ? 'positive' : 'negative'}>
                  {signedDollars(item.dollars, true)}
                </strong>
              </button>
            );
          })}
        </div>

        {selected ? (
          <aside className="contribution-detail" aria-live="polite">
            <span>{groupLabel(selected.feature)}</span>
            {selected.dollars >= 0 ? (
              <ArrowUpRight aria-hidden="true" />
            ) : (
              <ArrowDownRight aria-hidden="true" />
            )}
            <h4>{selected.label}</h4>
            <p>{featureValues[selected.feature] ?? 'Model-derived value'}</p>
            <strong>{signedDollars(selected.dollars)}</strong>
            <small>
              Dollar-equivalent allocation · native SHAP{' '}
              {selected.value >= 0 ? '+' : ''}
              {selected.value.toFixed(4)} log1p
            </small>
          </aside>
        ) : null}
      </div>

      <p className="contribution-caveat">
        <Info size={14} aria-hidden="true" />
        <span>
          <strong>Interpret carefully.</strong> Dollar-equivalent allocations
          proportionally translate the exact log1p SHAP bridge through the
          model’s inverse link. They add back to this estimate, but they are not
          standalone appraisals, causal effects, or guaranteed price changes.
        </span>
      </p>
    </article>
  );
}
