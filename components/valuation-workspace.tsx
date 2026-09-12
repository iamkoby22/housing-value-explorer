'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  House,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { DollarContributionExplorer } from '@/components/dollar-contribution-explorer';
import { StaticLink } from '@/components/static-link';
import { displayFeature } from '@/lib/research-data';
import {
  estimateProperty,
  heatingOptions,
  householdOptions,
  lotOptions,
  structureOptions,
  type ValuationRequest,
  type ValuationResult,
  valuationRequestSchema,
} from '@/lib/valuation';

type FormState = {
  zipCode: string;
  bedrooms: string;
  otherRooms: string;
  lotSize: string;
  yearBuilt: string;
  structureType: string;
  heatingFuel: string;
  householdIncome: string;
  householdSize: string;
  householdType: string;
  yearMoved: string;
  firstMortgage: string;
  hoaFee: string;
  electricity: string;
  gas: string;
  otherFuel: string;
  waterSewer: string;
};

type SavedScenario = {
  id: string;
  name: string;
  payload: ValuationRequest;
  result: ValuationResult;
};

const EMPTY_FORM: FormState = {
  zipCode: '',
  bedrooms: '',
  otherRooms: '',
  lotSize: '',
  yearBuilt: '',
  structureType: '',
  heatingFuel: '',
  householdIncome: '',
  householdSize: '',
  householdType: '',
  yearMoved: '',
  firstMortgage: '',
  hoaFee: '',
  electricity: '',
  gas: '',
  otherFuel: '',
  waterSewer: '',
};

const STEPS = ['Location', 'Home', 'Household', 'Housing costs', 'Review'];
const SESSION_KEY = 'housing-value-explorer-scenarios-v1';

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const compactDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function signedCompactDifference(value: number) {
  return `${value >= 0 ? '+' : '−'}${compactDollars.format(Math.abs(value))}`;
}

function optionalNumber(value: string) {
  return value.trim() === '' ? null : Number(value);
}

function formToPayload(form: FormState): ValuationRequest {
  return valuationRequestSchema.parse({
    zip_code: form.zipCode.trim(),
    bedrooms: optionalNumber(form.bedrooms),
    other_rooms: optionalNumber(form.otherRooms),
    lot_size: form.lotSize ? Number(form.lotSize) : null,
    year_built: optionalNumber(form.yearBuilt),
    structure_type: form.structureType || null,
    heating_fuel: form.heatingFuel || null,
    household_income: optionalNumber(form.householdIncome),
    household_size: optionalNumber(form.householdSize),
    household_type: form.householdType || null,
    year_moved: optionalNumber(form.yearMoved),
    first_mortgage: optionalNumber(form.firstMortgage),
    hoa_fee: optionalNumber(form.hoaFee),
    electricity: optionalNumber(form.electricity),
    gas: optionalNumber(form.gas),
    other_fuel: optionalNumber(form.otherFuel),
    water_sewer: optionalNumber(form.waterSewer),
  });
}

function fieldValue(value: string, fallback = 'I don’t know') {
  return value || fallback;
}

function NumberField({
  label,
  value,
  onChange,
  helper,
  min = 0,
  max,
  step = 1,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  return (
    <label className="valuation-field">
      <span>{label}</span>
      <div className={prefix ? 'field-with-prefix' : undefined}>
        {prefix ? <i>{prefix}</i> : null}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="I don’t know"
        />
      </div>
      <small>{helper}</small>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  helper,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="valuation-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">I don’t know</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small>{helper}</small>
    </label>
  );
}

function ContextRange({
  label,
  distribution,
  estimate,
}: {
  label: string;
  distribution: { p25: number; p50: number; p75: number; records: number };
  estimate: number;
}) {
  const low = Math.min(distribution.p25, estimate);
  const high = Math.max(distribution.p75, estimate);
  const span = Math.max(high - low, 1);
  const estimatePosition = ((estimate - low) / span) * 100;
  const q25 = ((distribution.p25 - low) / span) * 100;
  const q75 = ((distribution.p75 - low) / span) * 100;

  return (
    <div className="context-range">
      <div>
        <strong>{label}</strong>
        <small>{integer.format(distribution.records)} 2024 records</small>
      </div>
      <div className="range-track" aria-label={`${label} interquartile range`}>
        <i style={{ left: `${q25}%`, width: `${Math.max(q75 - q25, 2)}%` }} />
        <b
          style={{ left: `${estimatePosition}%` }}
          title="Your model estimate"
        />
      </div>
      <div className="range-labels">
        <span>{compactDollars.format(distribution.p25)}</span>
        <strong>Median {compactDollars.format(distribution.p50)}</strong>
        <span>{compactDollars.format(distribution.p75)}</span>
      </div>
    </div>
  );
}

export function ValuationWorkspace() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'guided' | 'advanced'>('guided');
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [scenarioForm, setScenarioForm] = useState<FormState>(EMPTY_FORM);
  const [scenarioResult, setScenarioResult] = useState<ValuationResult | null>(
    null,
  );
  const [scenarioName, setScenarioName] = useState('Scenario 1');
  const [scenarioMode, setScenarioMode] = useState<'recommended' | 'custom'>(
    'recommended',
  );
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved) as SavedScenario[];
    } catch {
      window.sessionStorage.removeItem(SESSION_KEY);
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateScenario = (key: keyof FormState, value: string) =>
    setScenarioForm((current) => ({ ...current, [key]: value }));

  const reviewRows = useMemo(
    () => [
      ['ZIP / ZCTA', fieldValue(form.zipCode)],
      ['Bedrooms', fieldValue(form.bedrooms)],
      ['Other rooms', fieldValue(form.otherRooms)],
      ['Year built', fieldValue(form.yearBuilt)],
      [
        'Structure',
        structureOptions.find((item) => item.value === form.structureType)
          ?.label ?? 'I don’t know',
      ],
      [
        'Lot size',
        lotOptions.find((item) => item.value === form.lotSize)?.label ??
          'I don’t know',
      ],
      [
        'Household income',
        form.householdIncome
          ? dollars.format(Number(form.householdIncome))
          : 'I don’t know',
      ],
      [
        'First mortgage',
        form.firstMortgage
          ? `${dollars.format(Number(form.firstMortgage))} / month`
          : 'I don’t know',
      ],
    ],
    [form],
  );

  async function submitEstimate() {
    setBusy(true);
    setError('');
    try {
      const payload = formToPayload(form);
      const next = await estimateProperty(payload);
      setResult(next);
      setScenarioForm(form);
      setScenarioResult(null);
      window.setTimeout(
        () =>
          document
            .getElementById('valuation-result')
            ?.scrollIntoView({ behavior: 'smooth' }),
        40,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The estimate could not be calculated.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function runScenarioProfile(nextForm: FormState) {
    setScenarioBusy(true);
    setError('');
    try {
      const next = await estimateProperty(formToPayload(nextForm));
      setScenarioResult(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The scenario could not be calculated.',
      );
    } finally {
      setScenarioBusy(false);
    }
  }

  async function runScenario() {
    await runScenarioProfile(scenarioForm);
  }

  async function applyRecommendation(
    opportunity: ValuationResult['opportunities'][number],
  ) {
    const nextForm = { ...form };
    if (opportunity.feature === 'bedrooms') {
      nextForm.bedrooms =
        opportunity.scenario.match(/\d+/)?.[0] ?? form.bedrooms;
    } else if (opportunity.feature === 'other_rooms') {
      nextForm.otherRooms =
        opportunity.scenario.match(/\d+/)?.[0] ?? form.otherRooms;
    } else if (opportunity.feature === 'heating_fuel') {
      nextForm.heatingFuel =
        heatingOptions.find((item) => item.label === opportunity.scenario)
          ?.value ?? form.heatingFuel;
    }
    setScenarioForm(nextForm);
    await runScenarioProfile(nextForm);
  }

  function persistScenarios(next: SavedScenario[]) {
    setSavedScenarios(next);
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }

  function saveScenario() {
    if (!scenarioResult || savedScenarios.length >= 5) return;
    persistScenarios([
      ...savedScenarios,
      {
        id: crypto.randomUUID(),
        name: scenarioName.trim() || `Scenario ${savedScenarios.length + 1}`,
        payload: formToPayload(scenarioForm),
        result: scenarioResult,
      },
    ]);
    setScenarioName(`Scenario ${savedScenarios.length + 2}`);
  }

  const strongestPositive = result?.shap.find((item) => item.value > 0);
  const strongestNegative = result?.shap.find((item) => item.value < 0);
  const maximumContribution = result
    ? Math.max(...result.shap.map((item) => Math.abs(item.value)))
    : 1;
  const comparisonDifference =
    scenarioResult && result ? scenarioResult.estimate - result.estimate : 0;
  const featureValues = useMemo<Record<string, string>>(
    () => ({
      bedroom_count: form.bedrooms
        ? `${form.bedrooms} bedrooms`
        : 'Unknown input',
      non_bedroom_rooms: form.otherRooms
        ? `${form.otherRooms} other rooms`
        : 'Unknown input',
      lot_size_order:
        lotOptions.find((item) => item.value === form.lotSize)?.label ??
        'Unknown input',
      year_built_order: form.yearBuilt || 'Unknown input',
      survey_year: '2024 · fixed prediction year',
      signed_log_household_income_2024: form.householdIncome
        ? dollars.format(Number(form.householdIncome))
        : 'Unknown input',
      household_size: form.householdSize
        ? `${form.householdSize} people`
        : 'Unknown input',
      year_moved_order: form.yearMoved || 'Unknown input',
      first_mortgage_log_2024: form.firstMortgage
        ? `${dollars.format(Number(form.firstMortgage))} / month`
        : 'Unknown input',
      hoa_fee_log_2024: form.hoaFee
        ? `${dollars.format(Number(form.hoaFee))} / month`
        : 'Unknown input',
      electricity_log_2024: form.electricity
        ? `${dollars.format(Number(form.electricity))} / month`
        : 'Unknown input',
      gas_log_2024: form.gas
        ? `${dollars.format(Number(form.gas))} / month`
        : 'Unknown input',
      other_fuel_log_2024: form.otherFuel
        ? `${dollars.format(Number(form.otherFuel))} / year`
        : 'Unknown input',
      water_sewer_log_2024: form.waterSewer
        ? `${dollars.format(Number(form.waterSewer))} / year`
        : 'Unknown input',
      structure_type:
        structureOptions.find((item) => item.value === form.structureType)
          ?.label ?? 'Unknown input',
      heating_fuel:
        heatingOptions.find((item) => item.value === form.heatingFuel)?.label ??
        'Unknown input',
      state_puma: result?.location.state_puma ?? 'Resolved after estimation',
      household_type:
        householdOptions.find((item) => item.value === form.householdType)
          ?.label ?? 'Unknown input',
    }),
    [form, result?.location.state_puma],
  );

  return (
    <div className="valuation-page">
      <section className="valuation-intro page-width">
        <div>
          <p className="eyebrow">Individual model inference</p>
          <h1>Estimate</h1>
          <p>
            Estimate a property using the trained research model, then inspect
            its local TreeSHAP explanation and carefully bounded scenarios.
          </p>
        </div>
        <aside>
          <House aria-hidden="true" />
          <strong>Five-state research coverage</strong>
          <span>California · Florida · New York · Tennessee · Texas</span>
        </aside>
      </section>

      <section className="valuation-workbench page-width">
        <div className="questionnaire-panel">
          <div className="questionnaire-toolbar">
            <div>
              <span>Property profile</span>
              <strong>{STEPS[step]}</strong>
            </div>
            <div className="mode-switch" aria-label="Questionnaire mode">
              <button
                aria-pressed={mode === 'guided'}
                onClick={() => setMode('guided')}
              >
                Guided
              </button>
              <button
                aria-pressed={mode === 'advanced'}
                onClick={() => setMode('advanced')}
              >
                Full detail
              </button>
            </div>
          </div>

          <ol className="questionnaire-progress" aria-label="Estimate progress">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={
                  index === step ? 'active' : index < step ? 'complete' : ''
                }
              >
                <button
                  onClick={() => setStep(index)}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span>{index < step ? <Check size={12} /> : index + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>

          <div className="questionnaire-step">
            {step === 0 ? (
              <>
                <div className="step-heading">
                  <span>01</span>
                  <div>
                    <h2>Where is the property?</h2>
                    <p>
                      ZIP is matched to a 2020 Census ZCTA, then allocated to
                      the largest-overlap 2020 State–PUMA.
                    </p>
                  </div>
                </div>
                <label className="valuation-field zip-field">
                  <span>Five-digit ZIP code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    value={form.zipCode}
                    onChange={(event) =>
                      update(
                        'zipCode',
                        event.target.value.replace(/\D/g, '').slice(0, 5),
                      )
                    }
                    placeholder="e.g. 37601"
                  />
                  <small>
                    USPS ZIPs without a matching Census ZCTA cannot be resolved.
                  </small>
                </label>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="step-heading">
                  <span>02</span>
                  <div>
                    <h2>Describe the home</h2>
                    <p>
                      Leave a field blank when you do not know it. The fitted
                      pipeline will use its documented missing-value treatment.
                    </p>
                  </div>
                </div>
                <div className="field-grid">
                  <NumberField
                    label="Bedrooms"
                    value={form.bedrooms}
                    onChange={(value) => update('bedrooms', value)}
                    helper="Count of bedrooms."
                    max={20}
                  />
                  <NumberField
                    label="Other rooms"
                    value={form.otherRooms}
                    onChange={(value) => update('otherRooms', value)}
                    helper="Rooms other than bedrooms."
                    max={30}
                  />
                  <NumberField
                    label="Year built"
                    value={form.yearBuilt}
                    onChange={(value) => update('yearBuilt', value)}
                    helper="Mapped to the model’s ACS construction-era category."
                    min={1700}
                    max={2024}
                  />
                  <SelectField
                    label="Structure"
                    value={form.structureType}
                    onChange={(value) => update('structureType', value)}
                    helper="The research cohort contains one-family houses."
                    options={structureOptions}
                  />
                  <SelectField
                    label="Lot size"
                    value={form.lotSize}
                    onChange={(value) => update('lotSize', value)}
                    helper="ACS lot-size band."
                    options={lotOptions}
                  />
                  <SelectField
                    label="Primary heating fuel"
                    value={form.heatingFuel}
                    onChange={(value) => update('heatingFuel', value)}
                    helper="Select the principal heating source."
                    options={heatingOptions}
                  />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="step-heading">
                  <span>03</span>
                  <div>
                    <h2>Household and occupancy</h2>
                    <p>
                      These are predictive model inputs, not property
                      improvements. They are never used as homeowner
                      recommendations.
                    </p>
                  </div>
                </div>
                <div className="field-grid">
                  <NumberField
                    label="Annual household income"
                    value={form.householdIncome}
                    onChange={(value) => update('householdIncome', value)}
                    helper="Annual amount in 2024-equivalent dollars; negative income is permitted."
                    min={-1_000_000}
                    max={20_000_000}
                    prefix="$"
                  />
                  <NumberField
                    label="Household size"
                    value={form.householdSize}
                    onChange={(value) => update('householdSize', value)}
                    helper="People living in the household."
                    min={1}
                    max={30}
                  />
                  <NumberField
                    label="Year moved in"
                    value={form.yearMoved}
                    onChange={(value) => update('yearMoved', value)}
                    helper="Mapped to the model’s ACS move-period category."
                    min={1900}
                    max={2024}
                  />
                  <SelectField
                    label="Household type"
                    value={form.householdType}
                    onChange={(value) => update('householdType', value)}
                    helper="Used for prediction and explanation, never recommendations."
                    options={householdOptions}
                  />
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="step-heading">
                  <span>04</span>
                  <div>
                    <h2>Housing costs</h2>
                    <p>
                      Enter zero when there is no charge. Leave blank when the
                      amount is unknown or included elsewhere.
                    </p>
                  </div>
                </div>
                <div className="field-grid">
                  <NumberField
                    label="First mortgage payment"
                    value={form.firstMortgage}
                    onChange={(value) => update('firstMortgage', value)}
                    helper="Monthly payment; enter 0 if none."
                    max={200_000}
                    prefix="$"
                  />
                  <NumberField
                    label="Condo or HOA fee"
                    value={form.hoaFee}
                    onChange={(value) => update('hoaFee', value)}
                    helper="Monthly amount."
                    max={100_000}
                    prefix="$"
                  />
                  <NumberField
                    label="Electricity"
                    value={form.electricity}
                    onChange={(value) => update('electricity', value)}
                    helper="Monthly cost."
                    max={50_000}
                    prefix="$"
                  />
                  <NumberField
                    label="Gas"
                    value={form.gas}
                    onChange={(value) => update('gas', value)}
                    helper="Monthly cost."
                    max={50_000}
                    prefix="$"
                  />
                  <NumberField
                    label="Other fuel"
                    value={form.otherFuel}
                    onChange={(value) => update('otherFuel', value)}
                    helper="Annual cost."
                    max={500_000}
                    prefix="$"
                  />
                  <NumberField
                    label="Water and sewer"
                    value={form.waterSewer}
                    onChange={(value) => update('waterSewer', value)}
                    helper="Annual cost."
                    max={500_000}
                    prefix="$"
                  />
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <div className="step-heading">
                  <span>05</span>
                  <div>
                    <h2>Review the profile</h2>
                    <p>
                      Unknown fields remain missing and are handled by the
                      fitted training pipeline. No values are silently invented.
                    </p>
                  </div>
                </div>
                <dl className="review-ledger">
                  {reviewRows.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {mode === 'guided' ? (
                  <p className="guided-note">
                    Guided mode accepts unknown optional fields. Full detail
                    exposes the same scientifically required inputs with
                    additional context.
                  </p>
                ) : (
                  <div className="advanced-model-notes">
                    <strong>Advanced input treatment</strong>
                    <span>
                      Survey year is fixed to 2024; ZIP resolves to State–PUMA;
                      money fields enter the notebook’s log1p transforms; blank
                      values follow fitted imputation and missingness
                      indicators.
                    </span>
                    <span>
                      Construction year and move year are mapped to their ACS
                      ordered categories. The estimator is identical in both
                      modes.
                    </span>
                  </div>
                )}
                <button
                  className="estimate-button"
                  onClick={submitEstimate}
                  disabled={busy}
                >
                  {busy ? 'Running the model…' : 'Calculate model estimate'}
                  {!busy ? <ArrowRight size={16} /> : null}
                </button>
              </>
            ) : null}
          </div>

          {error ? (
            <div className="valuation-error" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="step-actions">
            <button
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              <ArrowLeft size={15} /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() =>
                  setStep((current) => Math.min(STEPS.length - 1, current + 1))
                }
              >
                Continue <ArrowRight size={15} />
              </button>
            ) : null}
          </div>
        </div>

        <aside className="valuation-guardrails">
          <p className="eyebrow">Before you estimate</p>
          <h2>What this tool is—and is not</h2>
          <p>
            It applies the completed reduced XGBoost research model to the
            characteristics you enter. It does not access assessor records,
            listings, comparable sales, Zillow, Redfin, or Realtor data.
          </p>
          <ul>
            <li>Research estimate, not an appraisal</li>
            <li>Five-state coverage only</li>
            <li>ZIP resolves indirectly to model geography</li>
            <li>Predictions are observational, not causal</li>
            <li>No name, email, or street address requested</li>
          </ul>
          <StaticLink href="/research" className="text-link">
            Read the methodology
          </StaticLink>
        </aside>
      </section>

      {result ? (
        <section className="valuation-results" id="valuation-result">
          <div className="page-width">
            <div className="result-heading">
              <div>
                <p className="eyebrow">
                  Model estimate · {result.location.zip_code}
                </p>
                <h2>
                  {compactDollars.format(
                    Math.round(result.estimate / 1000) * 1000,
                  )}
                </h2>
                <p>
                  {dollars.format(result.estimate)} calculated value · not false
                  appraisal precision
                </p>
              </div>
              <div className="resolved-location">
                <span>{result.location.state_name}</span>
                <strong>{result.location.puma_name}</strong>
                <small>
                  ZCTA allocated by largest Census intersection area ·{' '}
                  {(result.location.allocation_area_share * 100).toFixed(1)}%
                  share
                </small>
              </div>
            </div>

            <div className="estimate-notice">
              <strong>Research-model estimate</strong>
              <span>{result.model.disclaimer}</span>
            </div>

            {result.support.status !== 'within_normal_range' ||
            result.location.ambiguous ? (
              <div className="support-warning">
                <AlertTriangle size={18} />
                <div>
                  <strong>
                    {result.support.status === 'outside_observed_support'
                      ? 'Some inputs are outside observed support'
                      : result.support.status === 'near_edge'
                        ? 'Some inputs are uncommon in the research data'
                        : 'The ZIP intersects multiple model areas'}
                  </strong>
                  {result.support.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                  {result.location.ambiguous ? (
                    <span>
                      This ZCTA intersects {result.location.intersecting_pumas}{' '}
                      PUMAs; the largest area share is not dominant.
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="result-grid">
              <article className="result-card local-context-card">
                <div className="result-card-heading">
                  <span>01 · Local context</span>
                  <h3>Where the estimate sits in the research data</h3>
                </div>
                <p className="context-position">
                  The estimate is {result.context.position} for this
                  State–PUMA’s 2024 cohort.
                </p>
                <ContextRange
                  label="Local model area"
                  distribution={result.context.model_area}
                  estimate={result.estimate}
                />
                <ContextRange
                  label={result.location.state_name}
                  distribution={result.context.state}
                  estimate={result.estimate}
                />
                <p className="figure-note">
                  Bars show survey-weighted 25th–75th percentiles of reported
                  2024 ACS values. They are context bands, not prediction
                  intervals.
                </p>
              </article>

              <article className="result-card performance-card">
                <div className="result-card-heading">
                  <span>Model performance</span>
                  <h3>Real temporal error context</h3>
                </div>
                <dl>
                  <div>
                    <dt>2024 median absolute error</dt>
                    <dd>
                      {compactDollars.format(
                        result.model.temporal_median_absolute_error,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>2024 mean absolute error</dt>
                    <dd>{compactDollars.format(result.model.temporal_mae)}</dd>
                  </div>
                  <div>
                    <dt>2024 R²</dt>
                    <dd>{result.model.temporal_r_squared.toFixed(3)}</dd>
                  </div>
                </dl>
                <p>
                  No individual confidence interval was established by the
                  study, so none is invented here.
                </p>
              </article>

              <article className="result-card explanation-card">
                <div className="result-card-heading">
                  <span>02 · Why this estimate?</span>
                  <h3>Local TreeSHAP prediction decomposition</h3>
                </div>
                <p className="explanation-story">
                  The strongest upward model contribution is{' '}
                  <strong>{strongestPositive?.label ?? 'not distinct'}</strong>.
                  The strongest downward contribution is{' '}
                  <strong>{strongestNegative?.label ?? 'not distinct'}</strong>.
                  These describe this fitted model’s prediction, not causal
                  effects on sale value.
                </p>
                <div className="shap-ledger">
                  {result.shap.slice(0, 10).map((item) => (
                    <div key={item.feature}>
                      <span>{item.rank.toString().padStart(2, '0')}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>
                          {item.magnitude} · {item.direction}
                        </small>
                      </div>
                      <div className="shap-track">
                        <i
                          className={
                            item.value >= 0 ? 'positive-bar' : 'negative-bar'
                          }
                          style={{
                            width: `${Math.max((Math.abs(item.value) / maximumContribution) * 100, 1)}%`,
                          }}
                        />
                      </div>
                      <b>
                        {item.value >= 0 ? '+' : ''}
                        {item.value.toFixed(3)}
                      </b>
                    </div>
                  ))}
                </div>
                <div className="shap-equation">
                  <span>
                    Baseline <strong>{result.baseline_log1p.toFixed(3)}</strong>
                  </span>
                  <span>+ contributions</span>
                  <span>
                    = prediction{' '}
                    <strong>{result.prediction_log1p.toFixed(3)}</strong>
                  </span>
                  <span
                    className={
                      result.additivity.verified ? 'verified' : 'failed'
                    }
                  >
                    {result.additivity.verified ? (
                      <Check size={13} />
                    ) : (
                      <AlertTriangle size={13} />
                    )}
                    Additivity difference{' '}
                    {result.additivity.absolute_difference.toExponential(2)}
                  </span>
                </div>
                <p className="figure-note">
                  Canonical SHAP values remain in log1p model-output units. They
                  are not mislabeled as dollar changes.
                </p>
              </article>

              <DollarContributionExplorer
                result={result}
                featureValues={featureValues}
              />

              <article className="result-card driver-comparison-card">
                <div className="result-card-heading">
                  <span>03 · Explanation in context</span>
                  <h3>This home versus typical local drivers</h3>
                </div>
                <div className="driver-comparison">
                  <div>
                    <h4>For this home</h4>
                    {result.shap
                      .filter((item) => item.feature !== 'state_puma')
                      .slice(0, 5)
                      .map((item) => (
                        <p key={item.feature}>
                          <span>{item.rank}</span>
                          <strong>{item.label}</strong>
                          <small>{item.value >= 0 ? 'Higher' : 'Lower'}</small>
                        </p>
                      ))}
                  </div>
                  <div>
                    <h4>Typical in this model area</h4>
                    {result.local_drivers.slice(0, 5).map((item) => (
                      <p key={item.feature}>
                        <span>{item.rank}</span>
                        <strong>{displayFeature(item.feature)}</strong>
                        <small>{item.importance.toFixed(3)}</small>
                      </p>
                    ))}
                  </div>
                </div>
              </article>
            </div>

            <section className="scenario-lab">
              <div className="scenario-heading">
                <div>
                  <p className="eyebrow">04 · Scenario Lab</p>
                  <h2>Test plausible property scenarios</h2>
                </div>
                <p>
                  Each scenario reruns the actual model while holding all other
                  entered characteristics fixed. This is model sensitivity—not
                  renovation ROI or causal advice.
                </p>
              </div>

              <div
                className="scenario-mode-switch"
                aria-label="Scenario method"
              >
                <button
                  aria-pressed={scenarioMode === 'recommended'}
                  onClick={() => setScenarioMode('recommended')}
                  type="button"
                >
                  Recommended tests
                  <small>Pre-screened, model-sensitive changes</small>
                </button>
                <button
                  aria-pressed={scenarioMode === 'custom'}
                  onClick={() => setScenarioMode('custom')}
                  type="button"
                >
                  Custom scenario
                  <small>Build your own governed comparison</small>
                </button>
              </div>

              {scenarioMode === 'recommended' ? (
                result.opportunities.length ? (
                  <div className="opportunity-list interactive-opportunities">
                    <h3>
                      Choose a recommendation to test with the actual model
                    </h3>
                    {result.opportunities.map((item) => (
                      <article key={`${item.feature}-${item.scenario}`}>
                        <span>{item.label}</span>
                        <strong>{item.scenario}</strong>
                        <b>{signedCompactDifference(item.difference)}</b>
                        <small>
                          Previewed model difference ·{' '}
                          {item.percent_difference >= 0 ? '+' : ''}
                          {item.percent_difference.toFixed(1)}%
                        </small>
                        <button
                          disabled={scenarioBusy}
                          onClick={() => applyRecommendation(item)}
                          type="button"
                        >
                          {scenarioBusy ? 'Running…' : 'Test this scenario'}
                          <ArrowRight size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="scenario-empty">
                    <strong>
                      No higher-value governed scenario was identified.
                    </strong>
                    <span>
                      Use the custom builder to test bedrooms, other rooms, or
                      heating fuel without changing protected or fixed inputs.
                    </span>
                    <button
                      onClick={() => setScenarioMode('custom')}
                      type="button"
                    >
                      Open custom builder <ArrowRight size={14} />
                    </button>
                  </div>
                )
              ) : (
                <div className="scenario-controls">
                  <NumberField
                    label="Bedrooms"
                    value={scenarioForm.bedrooms}
                    onChange={(value) => updateScenario('bedrooms', value)}
                    helper="Potentially modifiable only when structurally feasible."
                    max={20}
                  />
                  <NumberField
                    label="Other rooms"
                    value={scenarioForm.otherRooms}
                    onChange={(value) => updateScenario('otherRooms', value)}
                    helper="Represents room configuration, not guaranteed construction."
                    max={30}
                  />
                  <SelectField
                    label="Heating fuel"
                    value={scenarioForm.heatingFuel}
                    onChange={(value) => updateScenario('heatingFuel', value)}
                    helper="A system-level scenario; feasibility is not assessed."
                    options={heatingOptions}
                  />
                  <div className="scenario-buttons">
                    <button onClick={runScenario} disabled={scenarioBusy}>
                      {scenarioBusy ? 'Rerunning…' : 'Run custom scenario'}
                    </button>
                    <button
                      onClick={() => {
                        setScenarioForm(form);
                        setScenarioResult(null);
                      }}
                    >
                      <RotateCcw size={14} /> Reset original
                    </button>
                  </div>
                </div>
              )}

              {scenarioResult ? (
                <div className="scenario-comparison">
                  <div>
                    <span>Original estimate</span>
                    <strong>{compactDollars.format(result.estimate)}</strong>
                  </div>
                  <div>
                    <span>Scenario estimate</span>
                    <strong>
                      {compactDollars.format(scenarioResult.estimate)}
                    </strong>
                  </div>
                  <div
                    className={
                      comparisonDifference >= 0 ? 'positive' : 'negative'
                    }
                  >
                    <span>Model difference</span>
                    <strong>
                      {comparisonDifference >= 0 ? '+' : ''}
                      {compactDollars.format(comparisonDifference)}
                    </strong>
                    <small>
                      {comparisonDifference >= 0 ? '+' : ''}
                      {((comparisonDifference / result.estimate) * 100).toFixed(
                        1,
                      )}
                      %
                    </small>
                  </div>
                  <div className="save-scenario">
                    <input
                      aria-label="Scenario name"
                      value={scenarioName}
                      onChange={(event) => setScenarioName(event.target.value)}
                      maxLength={40}
                    />
                    <button
                      onClick={saveScenario}
                      disabled={savedScenarios.length >= 5}
                    >
                      <Save size={14} /> Save in this tab
                    </button>
                  </div>
                </div>
              ) : null}

              {savedScenarios.length ? (
                <div className="saved-scenarios">
                  <div>
                    <h3>Saved comparisons</h3>
                    <span>Session only · up to five</span>
                  </div>
                  {savedScenarios.map((saved) => (
                    <article key={saved.id}>
                      <input
                        aria-label={`Rename ${saved.name}`}
                        value={saved.name}
                        onChange={(event) =>
                          persistScenarios(
                            savedScenarios.map((item) =>
                              item.id === saved.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <strong>
                        {compactDollars.format(saved.result.estimate)}
                      </strong>
                      <small>
                        {saved.result.estimate - result.estimate >= 0
                          ? '+'
                          : ''}
                        {compactDollars.format(
                          saved.result.estimate - result.estimate,
                        )}{' '}
                        vs original
                      </small>
                      <button
                        title="Duplicate into Scenario Lab"
                        onClick={() => {
                          setScenarioForm({
                            ...form,
                            bedrooms: saved.payload.bedrooms?.toString() ?? '',
                            otherRooms:
                              saved.payload.other_rooms?.toString() ?? '',
                            heatingFuel: saved.payload.heating_fuel ?? '',
                          });
                          setScenarioResult(saved.result);
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        title="Delete scenario"
                        onClick={() =>
                          persistScenarios(
                            savedScenarios.filter(
                              (item) => item.id !== saved.id,
                            ),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="valuation-links">
              <div>
                <p className="eyebrow">Continue into the evidence</p>
                <h2>Interrogate this model area</h2>
              </div>
              <nav aria-label="Related research views">
                <StaticLink
                  href={`/explore?module=geography&state=${encodeURIComponent(result.location.state_name)}&level=puma&puma=${encodeURIComponent(result.location.state_puma)}`}
                >
                  Open geography <ArrowRight size={14} />
                </StaticLink>
                <StaticLink
                  href={`/drivers?module=drivers&state=${encodeURIComponent(result.location.state_name)}&level=puma&puma=${encodeURIComponent(result.location.state_puma)}`}
                >
                  Open drivers & SHAP <ArrowRight size={14} />
                </StaticLink>
                <StaticLink href="/model?module=models">
                  Review models <ArrowRight size={14} />
                </StaticLink>
                <StaticLink href="/research">
                  Read methods <ArrowRight size={14} />
                </StaticLink>
              </nav>
            </section>

            <details className="technical-details">
              <summary>Technical model and geography details</summary>
              <div>
                <p>
                  <strong>Estimator:</strong> {result.model.name}
                </p>
                <p>
                  <strong>Model geography:</strong> {result.location.state_puma}
                </p>
                <p>
                  <strong>Approximate county:</strong>{' '}
                  {result.context.model_area.approximate_county_label} (
                  {result.context.model_area.county_overlap_percent.toFixed(1)}%
                  median PUMA–county overlap)
                </p>
                <p>
                  <strong>SHAP:</strong> exact XGBoost TreeSHAP in log1p output
                  units; additivity verified per prediction.
                </p>
                <p>
                  <strong>Privacy:</strong> {result.privacy} Saved scenarios use
                  session storage and disappear when this browser tab closes.
                </p>
              </div>
            </details>
          </div>
        </section>
      ) : null}
    </div>
  );
}
