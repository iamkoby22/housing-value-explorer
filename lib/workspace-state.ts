export const workspaceModules = [
  'housing',
  'geography',
  'compare',
  'drivers',
  'models',
  'diagnostics',
  'methodology',
] as const;

export type WorkspaceModule = (typeof workspaceModules)[number];
export type GeographyLevel = 'state' | 'county' | 'puma';

export type WorkspaceState = {
  module: WorkspaceModule;
  state: string;
  level: GeographyLevel;
  county: string;
  puma: string;
  feature: string;
  metric: 'importance' | 'direction';
  comparison: string;
  sidebarCollapsed: boolean;
};

export const defaultWorkspaceState: WorkspaceState = {
  module: 'housing',
  state: 'California',
  level: 'state',
  county: '',
  puma: '',
  feature: 'first_mortgage_log_2024',
  metric: 'importance',
  comparison: '',
  sidebarCollapsed: false,
};

export type WorkspaceAction =
  | { type: 'hydrate'; value: WorkspaceState }
  | { type: 'set-module'; value: WorkspaceModule }
  | { type: 'set-state'; value: string }
  | { type: 'set-level'; value: GeographyLevel }
  | { type: 'set-county'; value: string }
  | { type: 'set-puma'; value: string }
  | { type: 'set-feature'; value: string }
  | { type: 'set-metric'; value: 'importance' | 'direction' }
  | { type: 'set-comparison'; value: string }
  | { type: 'toggle-sidebar' };

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'hydrate':
      return action.value;
    case 'set-module':
      return { ...state, module: action.value };
    case 'set-state':
      return { ...state, state: action.value, county: '', puma: '' };
    case 'set-level':
      return {
        ...state,
        level: action.value,
        county: action.value === 'county' ? state.county : '',
        puma: action.value === 'puma' ? state.puma : '',
      };
    case 'set-county':
      return { ...state, county: action.value, puma: '', level: 'county' };
    case 'set-puma':
      return { ...state, puma: action.value, county: '', level: 'puma' };
    case 'set-feature':
      return { ...state, feature: action.value };
    case 'set-metric':
      return { ...state, metric: action.value };
    case 'set-comparison':
      return { ...state, comparison: action.value };
    case 'toggle-sidebar':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
  }
}

export function parseWorkspaceQuery(query: URLSearchParams): WorkspaceState {
  const moduleValue = query.get('module');
  const levelValue = query.get('level');
  const metricValue = query.get('metric');
  return {
    ...defaultWorkspaceState,
    module: workspaceModules.includes(moduleValue as WorkspaceModule)
      ? (moduleValue as WorkspaceModule)
      : defaultWorkspaceState.module,
    state: query.get('state') || defaultWorkspaceState.state,
    level: ['state', 'county', 'puma'].includes(levelValue ?? '')
      ? (levelValue as GeographyLevel)
      : defaultWorkspaceState.level,
    county: query.get('county') ?? '',
    puma: query.get('puma') ?? '',
    feature: query.get('feature') || defaultWorkspaceState.feature,
    metric: metricValue === 'direction' ? 'direction' : 'importance',
    comparison: query.get('compare') ?? '',
  };
}

export function serializeWorkspaceQuery(state: WorkspaceState): string {
  const query = new URLSearchParams({
    module: state.module,
    state: state.state,
    level: state.level,
  });
  if (state.county) query.set('county', state.county);
  if (state.puma) query.set('puma', state.puma);
  if (state.feature) query.set('feature', state.feature);
  if (state.metric === 'direction') query.set('metric', state.metric);
  if (state.comparison) query.set('compare', state.comparison);
  return query.toString();
}
