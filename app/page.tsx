import { ImportanceChart } from '@/components/importance-chart';
import { ModelComparison } from '@/components/model-comparison';
import { SectionHeading } from '@/components/section-heading';
import { StaticLink } from '@/components/static-link';
import { compactInteger, dollars, integer } from '@/lib/format';
import {
  displayFeature,
  globalShap,
  models,
  states,
  studySummary,
} from '@/lib/research-data';

export default function OverviewPage() {
  const selected = models.find((model) => model.model.includes('selected'))!;
  const california = states.find((state) => state.state_name === 'California')!;
  const tennessee = states.find((state) => state.state_name === 'Tennessee')!;
  const importance = globalShap.map((item) => ({
    feature: item.feature,
    label: displayFeature(item.feature),
    value: item.survey_weighted_mean_absolute_SHAP,
  }));
  const modelChart = models.map((model) => ({
    model: model.model.replace(' (selected)', ''),
    cvMae: Number(model.cross_validation.mean_CV_MAE),
    testMae: Number(model.temporal_2024.test_MAE),
    selected: Boolean(model.cross_validation.selected_for_SHAP),
  }));

  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">Interactive research · ACS PUMS 2020–2024</p>
          <h1>
            Geographic variation in the drivers of predicted housing value
          </h1>
          <p className="hero-deck">
            Explainable machine learning across California, Florida, New York,
            Tennessee, and Texas—tracking how the same fitted model relies on
            housing, financial, household, and geographic information.
          </p>
        </div>
        <aside className="hero-aside">
          <span>Selected model</span>
          <strong>Reduced XGBoost</strong>
          <p>
            Chosen using five-fold development CV, then evaluated on 2024 and
            explained with TreeSHAP.
          </p>
          <StaticLink className="text-link" href="/explore">
            Explore the findings
          </StaticLink>
        </aside>
      </section>

      <nav
        className="overview-actions page-width"
        aria-label="Overview actions"
      >
        <StaticLink href="/explore">
          <span>Explore</span>
          <strong>Explore housing data</strong>
        </StaticLink>
        <StaticLink href="/estimate">
          <span>Estimate</span>
          <strong>Estimate a home</strong>
        </StaticLink>
        <StaticLink href="/drivers">
          <span>Drivers</span>
          <strong>View model drivers</strong>
        </StaticLink>
        <StaticLink href="/model">
          <span>Model</span>
          <strong>Inspect performance</strong>
        </StaticLink>
      </nav>

      <section className="scope-band" aria-label="Study scope">
        <div className="page-width scope-grid">
          <div>
            <strong>5</strong>
            <span>states</span>
          </div>
          <div>
            <strong>
              {compactInteger.format(studySummary.development_records)}
            </strong>
            <span>development records</span>
          </div>
          <div>
            <strong>2020–23</strong>
            <span>model development</span>
          </div>
          <div>
            <strong>2024</strong>
            <span>temporal evaluation</span>
          </div>
          <div>
            <strong>
              {compactInteger.format(studySummary.explanation_records_2024)}
            </strong>
            <span>records explained</span>
          </div>
        </div>
      </section>

      <section className="page-width section-grid state-landscape">
        <SectionHeading
          eyebrow="01 · Research landscape"
          title="One study, five housing markets"
          description="The 2024 explanation set spans 268,930 owner-occupied one-family housing records. Survey-weighted aggregation keeps the descriptive and geographic summaries aligned with the study design."
        />
        <div
          className="state-bars"
          aria-label="2024 explanation records by state"
        >
          {studySummary.state_records.map((state) => (
            <div key={state.state_name} className="state-bar-row">
              <span>{state.state_name}</span>
              <div>
                <i style={{ width: `${(state.records / 79636) * 100}%` }} />
              </div>
              <strong>{integer.format(state.records)}</strong>
            </div>
          ))}
          <p className="figure-note">
            Unweighted 2024 record counts used for TreeSHAP; survey weights are
            applied during aggregation.
          </p>
        </div>
      </section>

      <section className="ink-section">
        <div className="page-width">
          <SectionHeading
            eyebrow="02 · Model explanations"
            title="What the selected model relies on"
            description="Geography is prominent, but mortgage payment, household income, property age, and room configuration supply the leading substantive signals."
          />
          <div className="two-column-viz">
            <ImportanceChart data={importance} limit={9} />
            <div className="editorial-notes">
              <article>
                <span className="note-number">01</span>
                <h3>Geography is modeled directly</h3>
                <p>
                  <strong>State–PUMA</strong> has the largest global mean
                  absolute SHAP value (
                  {globalShap[0].survey_weighted_mean_absolute_SHAP.toFixed(3)}
                  ). It is shown separately so it does not obscure the
                  substantive predictors.
                </p>
              </article>
              <article>
                <span className="note-number">02</span>
                <h3>Mortgage and income lead beyond geography</h3>
                <p>
                  First-mortgage payment and household income are the first two
                  non-geographic features in every state-level ranking.
                </p>
              </article>
              <StaticLink className="text-link light" href="/drivers">
                Examine the drivers <span aria-hidden="true">→</span>
              </StaticLink>
            </div>
          </div>
        </div>
      </section>

      <section className="page-width heterogeneity-section">
        <SectionHeading
          eyebrow="03 · Geographic heterogeneity"
          title="The ranking is shared. The reliance is not identical."
          description="State summaries reveal variation in how strongly the fitted model uses the same non-geographic features."
        />
        <div className="comparison-ledger">
          <div className="comparison-header">
            <span>Feature</span>
            <span>California</span>
            <span>Tennessee</span>
          </div>
          {[
            'first_mortgage_log_2024',
            'signed_log_household_income_2024',
            'year_built_order',
          ].map((feature) => (
            <div className="comparison-row" key={feature}>
              <strong>{displayFeature(feature)}</strong>
              <span>{california.feature_importance[feature].toFixed(3)}</span>
              <span>{tennessee.feature_importance[feature].toFixed(3)}</span>
            </div>
          ))}
        </div>
        <p className="reading-note">
          For example, year built carries more than twice the mean absolute SHAP
          importance in Tennessee (
          {tennessee.feature_importance.year_built_order.toFixed(3)}) than in
          California (
          {california.feature_importance.year_built_order.toFixed(3)}). This is
          variation in model explanation—not evidence of different causal
          effects.
        </p>
      </section>

      <section className="paper-section">
        <div className="page-width model-story">
          <div>
            <SectionHeading
              eyebrow="04 · Validation"
              title="Selected before the clock moved forward"
            />
            <p>
              The 2024 data are not another random holdout. All model comparison
              and feature reduction occurred within 2020–2023 development folds;
              2024 provides a temporal test of generalization.
            </p>
            <dl className="metric-ledger">
              <div>
                <dt>Mean development CV MAE</dt>
                <dd>
                  {dollars.format(
                    Number(selected.cross_validation.mean_CV_MAE),
                  )}
                </dd>
              </div>
              <div>
                <dt>2024 temporal MAE</dt>
                <dd>
                  {dollars.format(Number(selected.temporal_2024.test_MAE))}
                </dd>
              </div>
              <div>
                <dt>2024 median absolute error</dt>
                <dd>
                  {dollars.format(
                    Number(selected.temporal_2024.test_median_absolute_error),
                  )}
                </dd>
              </div>
              <div>
                <dt>2024 R²</dt>
                <dd>
                  {Number(selected.temporal_2024.test_R_squared).toFixed(3)}
                </dd>
              </div>
            </dl>
            <StaticLink className="primary-link" href="/model">
              See the model evidence <span aria-hidden="true">→</span>
            </StaticLink>
          </div>
          <ModelComparison data={modelChart} />
        </div>
      </section>

      <section className="page-width method-teaser">
        <div>
          <p className="eyebrow">Research safeguards</p>
          <h2>Explain the prediction. Preserve the limits.</h2>
        </div>
        <div className="method-steps">
          <p>
            <span>01</span>Development-only selection and reduction
          </p>
          <p>
            <span>02</span>Temporal evaluation on all eligible 2024 records
          </p>
          <p>
            <span>03</span>Survey-weighted TreeSHAP aggregation
          </p>
          <p>
            <span>04</span>Approximate counties shown with overlap reliability
          </p>
        </div>
      </section>
    </>
  );
}
