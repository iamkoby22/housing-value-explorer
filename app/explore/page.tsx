import type { Metadata } from 'next';

import { SectionHeading } from '@/components/section-heading';
import { StateExplorer } from '@/components/state-explorer';
import { featureById, states, studySummary } from '@/lib/research-data';

export const metadata: Metadata = { title: 'Explore' };

export default function ExplorePage() {
  const labels = Object.fromEntries(
    Object.entries(featureById).map(([key, value]) => [
      key,
      value.display_name,
    ]),
  );
  return (
    <div className="page-width page-shell">
      <header className="page-intro">
        <p className="eyebrow">Geographic explanations</p>
        <h1>Explore where the model relies on each signal</h1>
        <p>
          Select a state to inspect its 2024 survey-weighted SHAP profile.
          County and State-PUMA layers are prepared in the data architecture for
          deeper interaction in Phase 2.
        </p>
      </header>
      <StateExplorer states={states} labels={labels} />

      <section className="geography-levels">
        <SectionHeading
          eyebrow="Available geographic evidence"
          title="Three levels, three different meanings"
        />
        <div className="level-grid">
          <article>
            <span>Direct identifier</span>
            <h3>State</h3>
            <strong>5 geographies</strong>
            <p>Observed geography used for aggregated model explanations.</p>
          </article>
          <article>
            <span>Descriptive approximation</span>
            <h3>Approximate county</h3>
            <strong>{studySummary.approximate_county_count} summaries</strong>
            <p>
              Assigned from dominant PUMA–county overlap after modeling.
              Reliability metadata is required in every county view.
            </p>
          </article>
          <article>
            <span>Modeled geography</span>
            <h3>State–PUMA</h3>
            <strong>{studySummary.state_puma_count} areas</strong>
            <p>
              The direct geographic feature used by the fitted model and the
              best level for auditing geographic explanations.
            </p>
          </article>
        </div>
      </section>

      <aside className="county-caveat">
        <div>
          <span className="reliability-dot higher" />
          Higher confidence:{' '}
          {studySummary.county_reliability_counts['Higher confidence']}
        </div>
        <div>
          <span className="reliability-dot moderate" />
          Moderate overlap:{' '}
          {studySummary.county_reliability_counts['Moderate overlap']}
        </div>
        <div>
          <span className="reliability-dot low" />
          Low sample: {studySummary.county_reliability_counts['Low sample']}
        </div>
        <p>
          County is a descriptive label derived from largest PUMA–county
          overlap—not an exact household county identifier.
        </p>
      </aside>
    </div>
  );
}
