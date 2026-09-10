import { z } from 'zod';

import featureMetadataJson from '@/public/data/feature-metadata.json';
import globalShapJson from '@/public/data/global-shap.json';
import methodologyJson from '@/public/data/methodology.json';
import modelPerformanceJson from '@/public/data/model-performance.json';
import dependenceJson from '@/public/data/shap-dependence.json';
import stateShapJson from '@/public/data/state-shap.json';
import studySummaryJson from '@/public/data/study-summary.json';

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ metadata: z.record(z.string(), z.unknown()), data });

export const featureSchema = z.object({
  feature: z.string(),
  ACS_source: z.string(),
  semantic_type: z.string(),
  transformation_and_encoding: z.string(),
  remaining_missing_handling: z.string(),
  included_in_selected_model: z.boolean(),
  display_name: z.string(),
  category: z.enum([
    'Property',
    'Household',
    'Financial',
    'Utilities',
    'Geography',
    'Survey',
  ]),
  description: z.string(),
});

const rankedFeatureSchema = z.object({
  rank: z.number(),
  feature: z.string(),
  importance: z.number(),
  mean_signed: z.number(),
  average_direction: z.string(),
  value_trend: z.string(),
  positive_share_pct: z.number(),
});

export const stateSchema = z.object({
  state_name: z.string(),
  records: z.number(),
  survey_weight_sum: z.number(),
  effective_sample_size: z.number(),
  top_features: z.array(rankedFeatureSchema).length(5),
  top_non_geographic_features: z.array(rankedFeatureSchema).length(5),
  feature_importance: z.record(z.string(), z.number()),
  feature_direction: z.record(z.string(), z.number()),
});

const modelSchema = z.object({
  model: z.string(),
  cross_validation: z.record(z.string(), z.unknown()),
  temporal_2024: z.record(z.string(), z.unknown()),
});

const dependenceSchema = z.object({
  feature: z.string(),
  feature_bin: z.string(),
  weighted_mean_feature_value: z.number(),
  weighted_mean_SHAP: z.number(),
  lower_95_SHAP: z.number(),
  upper_95_SHAP: z.number(),
  records: z.number(),
  effective_sample_size: z.number(),
});

const globalShapSchema = z.object({
  feature: z.string(),
  mean_absolute_SHAP: z.number(),
  survey_weighted_mean_absolute_SHAP: z.number(),
  SHAP_units: z.string(),
});

const studySummarySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  states: z.array(z.string()).length(5),
  development_period: z.string(),
  temporal_evaluation_year: z.number(),
  development_records: z.number(),
  explanation_records_2024: z.number(),
  state_count: z.number(),
  approximate_county_count: z.number(),
  state_puma_count: z.number(),
  model_feature_count: z.number(),
  selected_model: z.string(),
  state_records: z.array(
    z.object({
      state_name: z.string(),
      records: z.number(),
      survey_weight_sum: z.number(),
      effective_sample_size: z.number(),
    }),
  ),
  county_reliability_counts: z.record(z.string(), z.number()),
});

export const features = envelope(z.array(featureSchema)).parse(
  featureMetadataJson,
).data;
export const globalShap = envelope(z.array(globalShapSchema)).parse(
  globalShapJson,
).data;
export const states = envelope(z.array(stateSchema)).parse(stateShapJson).data;
export const studySummary =
  envelope(studySummarySchema).parse(studySummaryJson).data;
export const models = envelope(z.array(modelSchema)).parse(
  modelPerformanceJson,
).data;
export const dependence = envelope(z.array(dependenceSchema)).parse(
  dependenceJson,
).data;
export const methodology = envelope(z.record(z.string(), z.unknown())).parse(
  methodologyJson,
).data;

export type FeatureMetadata = z.infer<typeof featureSchema>;
export type StateResult = z.infer<typeof stateSchema>;

export const featureById = Object.fromEntries(
  features.map((feature) => [feature.feature, feature]),
);

export const displayFeature = (feature: string) =>
  featureById[feature]?.display_name ?? feature;
