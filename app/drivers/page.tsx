import type { Metadata } from 'next';

import { DependenceChart } from '@/components/dependence-chart';
import { ImportanceChart } from '@/components/importance-chart';
import { SectionHeading } from '@/components/section-heading';
import {
  dependence,
  displayFeature,
  features,
  globalShap,
} from '@/lib/research-data';

export const metadata: Metadata = { title: 'Drivers' };

export default function DriversPage() {
  const importance = globalShap.map((item) => ({
    feature: item.feature,
    label: displayFeature(item.feature),
    value: item.survey_weighted_mean_absolute_SHAP,
    category: features.find((feature) => feature.feature === item.feature)
      ?.category,
  }));
  const dependenceFeatures = [
    ...new Set(dependence.map((item) => item.feature)),
  ].map((feature) => ({ id: feature, label: displayFeature(feature) }));

  return (
    <div className="page-width page-shell">
      <header className="page-intro">
        <p className="eyebrow">TreeSHAP interpretation</p>
        <h1>What contributes to the model’s predictions?</h1>
        <p>
          Importance ranks how much the selected model relies on a feature.
          Direction shows whether a feature’s contribution sits above or below
          the model baseline on average. Neither quantity is causal.
        </p>
      </header>

      <section className="drivers-grid">
        <SectionHeading
          eyebrow="Global importance"
          title="Separate place from substance"
          description="Toggle geography off to focus on housing, financing, household, utility, and survey predictors."
        />
        <ImportanceChart data={importance} allowGeographyToggle limit={18} />
      </section>

      <section className="dependence-section">
        <SectionHeading
          eyebrow="Feature dependence"
          title="How contribution changes across observed values"
          description="These publication-readiness summaries bin 2024 TreeSHAP values for six leading non-geographic features."
        />
        <DependenceChart data={dependence} options={dependenceFeatures} />
      </section>

      <section className="feature-registry">
        <SectionHeading
          eyebrow="Feature registry"
          title="Eighteen semantic inputs, documented"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Category</th>
                <th>ACS source</th>
                <th>Representation</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.feature}>
                  <th>
                    <strong>{feature.display_name}</strong>
                    <code>{feature.feature}</code>
                  </th>
                  <td>{feature.category}</td>
                  <td>{feature.ACS_source}</td>
                  <td>{feature.transformation_and_encoding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
