import { z } from 'zod';

const configuredInferenceApiUrl =
  process.env.NEXT_PUBLIC_INFERENCE_API_URL?.trim().replace(/\/+$/, '');
const inferenceApiUrl = configuredInferenceApiUrl || 'http://127.0.0.1:8765';

if (
  process.env.NODE_ENV === 'production' &&
  configuredInferenceApiUrl &&
  !configuredInferenceApiUrl.startsWith('https://')
) {
  throw new Error(
    'NEXT_PUBLIC_INFERENCE_API_URL must use HTTPS in production.',
  );
}

const optionalFinite = (minimum: number, maximum: number) =>
  z.number().min(minimum).max(maximum).nullable();

export const valuationRequestSchema = z.object({
  zip_code: z.string().regex(/^\d{5}$/),
  bedrooms: optionalFinite(0, 20),
  other_rooms: optionalFinite(0, 30),
  lot_size: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  year_built: optionalFinite(1700, 2024),
  structure_type: z.enum(['2', '3']).nullable(),
  heating_fuel: z
    .enum(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    .nullable(),
  household_income: optionalFinite(-1_000_000, 20_000_000),
  household_size: optionalFinite(1, 30),
  household_type: z.enum(['1', '2', '3', '4', '5', '6', '7']).nullable(),
  year_moved: optionalFinite(1900, 2024),
  first_mortgage: optionalFinite(0, 200_000),
  hoa_fee: optionalFinite(0, 100_000),
  electricity: optionalFinite(0, 50_000),
  gas: optionalFinite(0, 50_000),
  other_fuel: optionalFinite(0, 500_000),
  water_sewer: optionalFinite(0, 500_000),
  user_estimated_cost: optionalFinite(0, 100_000_000).optional(),
});

const shapSchema = z.object({
  rank: z.number(),
  feature: z.string(),
  label: z.string(),
  value: z.number(),
  direction: z.string(),
  magnitude: z.string(),
  units: z.string(),
});

const contextDistributionSchema = z.object({
  records: z.number(),
  survey_weight_sum: z.number(),
  p10: z.number(),
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p90: z.number(),
});

const localDriverSchema = z.object({
  rank: z.number(),
  feature: z.string(),
  importance: z.number(),
  mean_signed: z.number(),
  average_direction: z.string(),
  value_trend: z.string(),
  positive_share_pct: z.number(),
});

export const valuationResultSchema = z.object({
  estimate: z.number(),
  prediction_log1p: z.number(),
  baseline_log1p: z.number(),
  baseline_dollars_for_orientation: z.number(),
  shap: z.array(shapSchema).length(18),
  additivity: z.object({
    expected_plus_shap: z.number(),
    model_output: z.number(),
    absolute_difference: z.number(),
    verified: z.boolean(),
  }),
  location: z.object({
    zip_code: z.string(),
    state_fips: z.string(),
    state_name: z.string(),
    state_puma: z.string(),
    puma_name: z.string(),
    allocation_area_share: z.number(),
    intersecting_pumas: z.number(),
    ambiguous: z.boolean(),
    seen_in_model: z.boolean(),
    alternatives: z.array(z.record(z.string(), z.unknown())),
  }),
  support: z.object({
    status: z.enum([
      'within_normal_range',
      'near_edge',
      'outside_observed_support',
    ]),
    warnings: z.array(z.string()),
  }),
  context: z.object({
    model_area: contextDistributionSchema.extend({
      state_name: z.string(),
      approximate_county_id: z.string(),
      approximate_county_label: z.string(),
      county_overlap_percent: z.number(),
    }),
    state: contextDistributionSchema.extend({ state_name: z.string() }),
    study: contextDistributionSchema,
    position: z.string(),
  }),
  local_drivers: z.array(localDriverSchema),
  opportunities: z.array(
    z.object({
      feature: z.string(),
      label: z.string(),
      scenario: z.string(),
      estimate: z.number(),
      difference: z.number(),
      percent_difference: z.number(),
    }),
  ),
  model: z.object({
    name: z.string(),
    development_years: z.string(),
    prediction_year: z.number(),
    temporal_mae: z.number(),
    temporal_median_absolute_error: z.number(),
    temporal_r_squared: z.number(),
    disclaimer: z.string(),
  }),
  privacy: z.string(),
});

export type ValuationRequest = z.infer<typeof valuationRequestSchema>;
export type ValuationResult = z.infer<typeof valuationResultSchema>;
export type DollarEquivalentContribution = ValuationResult['shap'][number] & {
  dollars: number;
};

/**
 * Re-expresses the exact log1p SHAP bridge as an additive dollar bridge.
 * This preserves the model's baseline-to-prediction total, but it is an
 * explanatory allocation—not a causal or standalone price effect.
 */
export function allocateShapToDollars(
  result: Pick<
    ValuationResult,
    'baseline_dollars_for_orientation' | 'estimate' | 'shap'
  >,
): DollarEquivalentContribution[] {
  const shapTotal = result.shap.reduce((sum, item) => sum + item.value, 0);
  const dollarDifference =
    result.estimate - result.baseline_dollars_for_orientation;
  const scale = Math.abs(shapTotal) > 1e-12 ? dollarDifference / shapTotal : 0;

  return result.shap.map((item) => ({
    ...item,
    dollars: item.value * scale,
  }));
}

export async function estimateProperty(
  request: ValuationRequest,
): Promise<ValuationResult> {
  const payload = valuationRequestSchema.parse(request);
  const response = await fetch(`${inferenceApiUrl}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { data?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(
      body.error ?? 'The local inference service rejected this profile.',
    );
  }
  return valuationResultSchema.parse(body.data);
}

export const structureOptions = [
  { value: '2', label: 'One-family detached house' },
  { value: '3', label: 'One-family attached house' },
] as const;

export const lotOptions = [
  { value: '1', label: 'Less than 1 acre' },
  { value: '2', label: '1 to less than 10 acres' },
  { value: '3', label: '10 acres or more' },
] as const;

export const heatingOptions = [
  { value: '1', label: 'Utility gas' },
  { value: '2', label: 'Bottled, tank, or LP gas' },
  { value: '3', label: 'Electricity' },
  { value: '4', label: 'Fuel oil, kerosene, or similar' },
  { value: '5', label: 'Coal or coke' },
  { value: '6', label: 'Wood' },
  { value: '7', label: 'Solar energy' },
  { value: '8', label: 'Other fuel' },
  { value: '9', label: 'No fuel used' },
] as const;

export const householdOptions = [
  { value: '1', label: 'Married-couple household' },
  { value: '2', label: 'Other family, male householder' },
  { value: '3', label: 'Other family, female householder' },
  { value: '4', label: 'Male householder living alone' },
  { value: '5', label: 'Male householder, not living alone' },
  { value: '6', label: 'Female householder living alone' },
  { value: '7', label: 'Female householder, not living alone' },
] as const;
