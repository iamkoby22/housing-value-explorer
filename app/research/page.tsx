import type { Metadata } from 'next';

import { SectionHeading } from '@/components/section-heading';
import { StaticLink } from '@/components/static-link';
import { features } from '@/lib/research-data';

export const metadata: Metadata = { title: 'Research' };

const limitations = [
  [
    'Predictive, not causal',
    'TreeSHAP decomposes model predictions. It does not estimate what would happen if a feature were changed.',
  ],
  [
    'Survey-reported response',
    'VALP is a respondent estimate that can be rounded, allocated, and state-specific top-coded; it is not an appraisal.',
  ],
  [
    'Geographic precision',
    'State and PUMA are observed. County labels are descriptive assignments from dominant PUMA–county overlap after modeling.',
  ],
  [
    'Survey uncertainty',
    'Housing-unit weights support aggregation, while the record bootstrap is a stability check—not an ACS SDR margin of error.',
  ],
  [
    'Scope',
    'The results cover five states and short-horizon temporal generalization to 2024, not every U.S. housing market.',
  ],
  [
    'Ordinal fields',
    'Year-built, year-moved, and lot-size values are ordered ACS categories, not equally spaced measurements.',
  ],
];

export default function ResearchPage() {
  return (
    <div className="page-width page-shell research-page">
      <header className="page-intro">
        <p className="eyebrow">Scientific documentation</p>
        <h1>Research design, traceability, and limits</h1>
        <p>
          This page describes the evidence already produced by the authoritative
          notebook and geographic SHAP workbook. The application is a
          presentation layer, not a second analytical pipeline.
        </p>
      </header>

      <section className="research-question">
        <span>Primary research question</span>
        <blockquote>
          How accurately can 2024 inflation-adjusted property values for
          owner-occupied one-family houses in five U.S. states be predicted from
          2020–2023 ACS PUMS property, household, financing, utility, and
          State-PUMA characteristics?
        </blockquote>
      </section>

      <section className="research-columns">
        <div>
          <SectionHeading eyebrow="Data" title="ACS PUMS housing microdata" />
          <p>
            California, Florida, New York, Tennessee, and Texas; 960,182
            development records from 2020–2023 and 268,930 temporal-evaluation
            records from 2024.
          </p>
          <p>
            The response is `VALP`, adjusted with `ADJHSG` to comparable dollar
            values. Housing-unit survey weights are used in relevant summaries.
          </p>
        </div>
        <div>
          <SectionHeading
            eyebrow="Model"
            title="Leakage-safe temporal design"
          />
          <p>
            All model comparison and feature reduction occurs inside development
            data. State–PUMA uses five-fold cross-fitted target encoding. No
            county column or target-related field enters the predictor matrix.
          </p>
          <p>
            The selected reduced XGBoost model uses a `log1p` target and 18
            documented semantic features.
          </p>
        </div>
        <div>
          <SectionHeading
            eyebrow="Interpretation"
            title="Survey-weighted TreeSHAP"
          />
          <p>
            Exact TreeSHAP values are calculated for all eligible 2024 records,
            then aggregated with housing-unit weights. Mean absolute SHAP
            measures contribution strength; mean signed SHAP measures average
            direction from the model baseline.
          </p>
          <p>SHAP units are log1p property-value units, not direct dollars.</p>
        </div>
      </section>

      <section className="workflow-section">
        <SectionHeading
          eyebrow="Reproducible workflow"
          title="From scientific source to public explorer"
        />
        <ol className="workflow-list">
          <li>
            <span>01</span>
            <strong>Develop</strong>
            <p>2020–2023 common folds and candidate-model comparison.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Select</strong>
            <p>Reduced XGBoost chosen by development MAE.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Evaluate</strong>
            <p>2024 opened once for temporal performance.</p>
          </li>
          <li>
            <span>04</span>
            <strong>Explain</strong>
            <p>TreeSHAP for 268,930 2024 records.</p>
          </li>
          <li>
            <span>05</span>
            <strong>Aggregate</strong>
            <p>
              Survey-weighted state, PUMA, and approximate-county summaries.
            </p>
          </li>
        </ol>
      </section>

      <section className="feature-summary">
        <SectionHeading eyebrow="Selected inputs" title="Feature categories" />
        <div className="category-list">
          {[...new Set(features.map((feature) => feature.category))].map(
            (category) => (
              <div key={category}>
                <strong>{category}</strong>
                <p>
                  {features
                    .filter((feature) => feature.category === category)
                    .map((feature) => feature.display_name)
                    .join(' · ')}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="limits-section">
        <SectionHeading
          eyebrow="Claim boundaries"
          title="What the study can—and cannot—say"
        />
        <div className="limits-grid">
          {limitations.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="provenance-panel">
        <div>
          <p className="eyebrow">Traceability</p>
          <h2>Every rendered result points back to the completed analysis.</h2>
        </div>
        <div>
          <p>
            The deterministic exporter parses the geographic workbook
            programmatically, normalizes notebook-produced CSVs, validates
            geography and feature consistency, and records SHA-256 source
            hashes.
          </p>
          <StaticLink
            className="primary-link"
            href="/data/source-manifest.json"
          >
            Open source manifest <span aria-hidden="true">→</span>
          </StaticLink>
        </div>
      </section>
    </div>
  );
}
