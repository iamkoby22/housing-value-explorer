import type { Metadata } from 'next';

import { ModelComparison } from '@/components/model-comparison';
import { SectionHeading } from '@/components/section-heading';
import { dollars } from '@/lib/format';
import { models } from '@/lib/research-data';

export const metadata: Metadata = { title: 'Model' };

export default function ModelPage() {
  const selected = models.find((model) => model.model.includes('selected'))!;
  const chartData = models.map((model) => ({
    model: model.model.replace(' (selected)', ''),
    cvMae: Number(model.cross_validation.mean_CV_MAE),
    testMae: Number(model.temporal_2024.test_MAE),
    selected: Boolean(model.cross_validation.selected_for_SHAP),
  }));
  return (
    <div className="page-width page-shell">
      <header className="page-intro">
        <p className="eyebrow">Predictive evidence</p>
        <h1>Model selection before temporal evaluation</h1>
        <p>
          Five model families were compared on common development folds. The
          reduced XGBoost specification was selected by development MAE before
          the 2024 data were opened for final evaluation and SHAP.
        </p>
      </header>

      <section className="timeline" aria-label="Modeling timeline">
        <div>
          <span>2020–2023</span>
          <strong>Develop and compare</strong>
          <p>
            Five-fold cross-validation, feature reduction, and final model
            selection.
          </p>
        </div>
        <i aria-hidden="true" />
        <div>
          <span>2024</span>
          <strong>Test forward in time</strong>
          <p>
            One temporal evaluation, followed by explanation of all 268,930
            eligible records.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Model comparison"
          title="Error increases when the model moves into 2024"
          description="Lower MAE is better. R² should be read alongside absolute and relative-error metrics."
        />
        <ModelComparison data={chartData} />
        <div className="table-scroll model-table">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>CV MAE</th>
                <th>CV R²</th>
                <th>2024 MAE</th>
                <th>2024 RMSE</th>
                <th>2024 R²</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr
                  key={model.model}
                  className={
                    model.model.includes('selected') ? 'selected-row' : ''
                  }
                >
                  <th>{model.model}</th>
                  <td>
                    {dollars.format(Number(model.cross_validation.mean_CV_MAE))}
                  </td>
                  <td>
                    {Number(model.cross_validation.mean_CV_R_squared).toFixed(
                      3,
                    )}
                  </td>
                  <td>
                    {dollars.format(Number(model.temporal_2024.test_MAE))}
                  </td>
                  <td>
                    {dollars.format(Number(model.temporal_2024.test_RMSE))}
                  </td>
                  <td>
                    {Number(model.temporal_2024.test_R_squared).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="selected-model-section">
        <SectionHeading
          eyebrow="Selected specification"
          title="Reduced XGBoost with a log1p target"
        />
        <div className="selected-grid">
          <dl className="metric-ledger">
            <div>
              <dt>Mean CV MAE</dt>
              <dd>
                {dollars.format(Number(selected.cross_validation.mean_CV_MAE))}
              </dd>
            </div>
            <div>
              <dt>95% CV MAE interval</dt>
              <dd>
                {dollars.format(
                  Number(selected.cross_validation.lower_95_CV_MAE),
                )}
                –
                {dollars.format(
                  Number(selected.cross_validation.upper_95_CV_MAE),
                )}
              </dd>
            </div>
            <div>
              <dt>2024 within 20%</dt>
              <dd>
                {Number(selected.temporal_2024.within_20_percent).toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt>2024 within 30%</dt>
              <dd>
                {Number(selected.temporal_2024.within_30_percent).toFixed(1)}%
              </dd>
            </div>
          </dl>
          <div className="plain-note">
            <h3>Why this model?</h3>
            <p>
              It had the lowest development-fold MAE. Full XGBoost was only $55
              higher on mean CV MAE, so the reduction is parsimonious rather
              than a large performance gain.
            </p>
            <h3>What the 2024 result means</h3>
            <p>
              The MAE generalization gap is{' '}
              {dollars.format(
                Number(selected.temporal_2024.MAE_generalization_gap),
              )}
              . The model carries signal forward in time, but substantial value
              variation remains unexplained.
            </p>
          </div>
        </div>
      </section>

      <section className="limitations-band">
        <strong>Read the metrics together.</strong>
        <p>
          Owner-reported, rounded, and top-coded values make large errors
          possible. A higher Random Forest R² does not erase its materially
          larger MAE; no single metric is treated as “accuracy.”
        </p>
      </section>
    </div>
  );
}
