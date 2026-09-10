import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import OverviewPage from '@/app/page';
import ResearchPage from '@/app/research/page';

describe('critical page rendering', () => {
  it('renders real Overview evidence and navigation targets', () => {
    const html = renderToStaticMarkup(<OverviewPage />);
    expect(html).toContain('Geographic variation in the drivers');
    expect(html).toContain('Reduced XGBoost');
    expect(html).toContain('268.9K');
    expect(html).toContain('href="/estimate"');
    expect(html).toContain('href="/explore"');
  });

  it('renders scientific boundaries on the Research page', () => {
    const html = renderToStaticMarkup(<ResearchPage />);
    expect(html).toContain('Predictive, not causal');
    expect(html).toContain('dominant PUMA–county overlap');
    expect(html).toContain('source-manifest.json');
  });
});
