import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import EvaluatePage from '@/app/evaluate/page';
import { WorkspaceSidebar } from '@/components/analysis-workspace';
import {
  defaultWorkspaceState,
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  workspaceReducer,
} from '@/lib/workspace-state';

describe('analytical workspace', () => {
  it('exposes the workspace route and loading state', () => {
    const html = renderToStaticMarkup(<EvaluatePage />);
    expect(html).toContain('Loading verified research output');
  });

  it('renders the full sidebar and public-research transition', () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebar
        active="geography"
        collapsed={false}
        mobileOpen={false}
        onToggle={() => undefined}
        onCloseMobile={() => undefined}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain('Back to research');
    expect(html).toContain('Housing');
    expect(html).toContain('Geography');
    expect(html).toContain('Compare');
    expect(html).toContain('Drivers &amp; SHAP');
    expect(html).toContain('Models');
    expect(html).toContain('Diagnostics');
    expect(html).toContain('Methodology');
    expect(html).toContain('aria-current="page"');
  });

  it('supports sidebar collapse and linked geography selections', () => {
    const collapsed = workspaceReducer(defaultWorkspaceState, {
      type: 'toggle-sidebar',
    });
    expect(collapsed.sidebarCollapsed).toBe(true);
    const county = workspaceReducer(collapsed, {
      type: 'set-county',
      value: '06001',
    });
    expect(county.level).toBe('county');
    expect(county.county).toBe('06001');
    const puma = workspaceReducer(county, {
      type: 'set-puma',
      value: '06_00101',
    });
    expect(puma.level).toBe('puma');
    expect(puma.puma).toBe('06_00101');
  });

  it('restores feature, metric, comparison, and geography from the URL', () => {
    const query = new URLSearchParams(
      'module=drivers&state=Texas&level=puma&puma=48_00101&feature=bedroom_count&metric=direction&compare=Florida',
    );
    const state = parseWorkspaceQuery(query);
    expect(state).toMatchObject({
      module: 'drivers',
      state: 'Texas',
      level: 'puma',
      puma: '48_00101',
      feature: 'bedroom_count',
      metric: 'direction',
      comparison: 'Florida',
    });
    expect(
      parseWorkspaceQuery(new URLSearchParams(serializeWorkspaceQuery(state))),
    ).toMatchObject(state);
  });
});
