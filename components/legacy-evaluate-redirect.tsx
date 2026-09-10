'use client';

import { useEffect } from 'react';

const routeByModule: Record<string, string> = {
  housing: '/explore',
  geography: '/explore',
  compare: '/explore',
  drivers: '/drivers',
  models: '/model',
  diagnostics: '/model',
  methodology: '/research',
};

export function legacyRouteForQuery(search: string) {
  const query = new URLSearchParams(search);
  const target = routeByModule[query.get('module') ?? 'housing'] ?? '/explore';
  const suffix = query.toString();
  return `${target}${suffix ? `?${suffix}` : ''}`;
}

export function LegacyEvaluateRedirect() {
  useEffect(() => {
    window.location.replace(legacyRouteForQuery(window.location.search));
  }, []);

  return (
    <output className="legacy-redirect">
      <strong>Opening the requested analytical module…</strong>
      <span>Your saved filters and geographic selections are preserved.</span>
    </output>
  );
}
