import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DriversPage from '@/app/drivers/page';
import EstimatePage from '@/app/estimate/page';
import EvaluatePage from '@/app/evaluate/page';
import ExplorePage from '@/app/explore/page';
import ModelPage from '@/app/model/page';
import OverviewPage from '@/app/page';
import ResearchPage from '@/app/research/page';
import {
  AppShell,
  isRouteActive,
  primaryNavigation,
  shellReducer,
} from '@/components/app-shell';
import { legacyRouteForQuery } from '@/components/legacy-evaluate-redirect';
import {
  defaultWorkspaceState,
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  workspaceReducer,
} from '@/lib/workspace-state';

describe('unified application shell', () => {
  it('defines the six canonical product destinations', () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual([
      'Overview',
      'Explore',
      'Estimate',
      'Drivers',
      'Model',
      'Research',
    ]);
    const html = renderToStaticMarkup(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    expect(html).toContain('class="app-sidebar');
    expect(html).toContain('aria-label="Collapse sidebar"');
    expect(html).toContain('aria-label="Open navigation"');
  });

  it('supports desktop collapse and the responsive drawer state', () => {
    const initial = { collapsed: false, mobileOpen: false };
    expect(shellReducer(initial, { type: 'toggle-collapse' }).collapsed).toBe(
      true,
    );
    const opened = shellReducer(initial, { type: 'open-mobile' });
    expect(opened.mobileOpen).toBe(true);
    expect(shellReducer(opened, { type: 'close-mobile' }).mobileOpen).toBe(
      false,
    );
  });

  it('keeps active state for nested canonical routes', () => {
    expect(isRouteActive('/estimate/result', '/estimate')).toBe(true);
    expect(isRouteActive('/drivers/local', '/drivers')).toBe(true);
    expect(isRouteActive('/explore', '/')).toBe(false);
  });

  it('wraps every primary page in the same shell contract', () => {
    const pages = [
      <OverviewPage key="overview" />,
      <ExplorePage key="explore" />,
      <EstimatePage key="estimate" />,
      <DriversPage key="drivers" />,
      <ModelPage key="model" />,
      <ResearchPage key="research" />,
    ];
    for (const page of pages) {
      const html = renderToStaticMarkup(<AppShell>{page}</AppShell>);
      expect(html).toContain('app-sidebar');
      expect(html.match(/aria-label="Primary navigation"/g)).toHaveLength(1);
    }
  });

  it('contains no legacy website/workspace split language', () => {
    const source = [
      'app/page.tsx',
      'components/analysis-workspace.tsx',
      'components/valuation-workspace.tsx',
    ]
      .map((path) => readFileSync(resolve(path), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /Back to research website|Back to research|Enter workspace|Evaluate the research/,
    );
  });
});

describe('legacy route compatibility', () => {
  it('renders a redirect status instead of a second application shell', () => {
    const html = renderToStaticMarkup(<EvaluatePage />);
    expect(html).toContain('Opening the requested analytical module');
    expect(html).not.toContain('app-sidebar');
  });

  it('preserves useful query state while selecting the canonical route', () => {
    const search =
      '?module=drivers&state=Texas&level=puma&puma=48_00101&feature=bedroom_count';
    expect(legacyRouteForQuery(search)).toBe(`/drivers${search}`);
    expect(legacyRouteForQuery('?module=diagnostics&state=Florida')).toBe(
      '/model?module=diagnostics&state=Florida',
    );
    expect(legacyRouteForQuery('?module=geography&county=06001')).toBe(
      '/explore?module=geography&county=06001',
    );
  });
});

describe('analytical workspace state', () => {
  it('supports linked geography selections', () => {
    const county = workspaceReducer(defaultWorkspaceState, {
      type: 'set-county',
      value: '06001',
    });
    expect(county.level).toBe('county');
    const puma = workspaceReducer(county, {
      type: 'set-puma',
      value: '06_00101',
    });
    expect(puma.level).toBe('puma');
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
