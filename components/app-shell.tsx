'use client';

import {
  BarChart3,
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  House,
  Map,
  Menu,
  Route,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useReducer, useState } from 'react';

export const primaryNavigation = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/explore', label: 'Explore', icon: Map },
  { href: '/estimate', label: 'Estimate', icon: Calculator },
  { href: '/drivers', label: 'Drivers', icon: Route },
  { href: '/model', label: 'Model', icon: BarChart3 },
  { href: '/research', label: 'Research', icon: BookOpen },
];

export type ShellState = { collapsed: boolean; mobileOpen: boolean };
export type ShellAction =
  | { type: 'hydrate-collapse'; value: boolean }
  | { type: 'toggle-collapse' }
  | { type: 'open-mobile' }
  | { type: 'close-mobile' };

export function shellReducer(
  state: ShellState,
  action: ShellAction,
): ShellState {
  switch (action.type) {
    case 'hydrate-collapse':
      return { ...state, collapsed: action.value };
    case 'toggle-collapse':
      return { ...state, collapsed: !state.collapsed };
    case 'open-mobile':
      return { ...state, mobileOpen: true };
    case 'close-mobile':
      return { ...state, mobileOpen: false };
  }
}

export function isRouteActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  );
  const [{ collapsed, mobileOpen }, dispatch] = useReducer(shellReducer, {
    collapsed: false,
    mobileOpen: false,
  });

  useEffect(() => {
    dispatch({
      type: 'hydrate-collapse',
      value: localStorage.getItem('housing-shell-collapsed') === 'true',
    });
    const restorePath = () => setPathname(window.location.pathname);
    const followInternalLink = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest('a');
      if (link?.origin === window.location.origin) {
        setPathname(new URL(link.href).pathname);
      }
    };
    window.addEventListener('popstate', restorePath);
    document.addEventListener('click', followInternalLink);
    return () => {
      window.removeEventListener('popstate', restorePath);
      document.removeEventListener('click', followInternalLink);
    };
  }, []);

  function toggleCollapsed() {
    localStorage.setItem('housing-shell-collapsed', String(!collapsed));
    dispatch({ type: 'toggle-collapse' });
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        className={`app-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="app-brand">
          <Link href="/" onClick={() => dispatch({ type: 'close-mobile' })}>
            <span className="app-mark">UB</span>
            <span className="app-brand-copy">
              <strong>Housing Value Explorer</strong>
              <small>ACS PUMS · 2020–2024</small>
            </span>
          </Link>
          <button
            className="app-mobile-close"
            onClick={() => dispatch({ type: 'close-mobile' })}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav>
          {primaryNavigation.map((item) => {
            const active = isRouteActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  setPathname(item.href);
                  dispatch({ type: 'close-mobile' });
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-meta">
          <span>Five-state research model</span>
          <small>Local · Phase 4</small>
        </div>
        <button
          className="app-sidebar-toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span>{collapsed ? '' : 'Collapse'}</span>
        </button>
      </aside>

      {mobileOpen ? (
        <button
          className="app-shell-scrim"
          onClick={() => dispatch({ type: 'close-mobile' })}
          aria-label="Close navigation overlay"
        />
      ) : null}

      <div className="app-stage">
        <header className="app-mobile-bar">
          <button
            onClick={() => dispatch({ type: 'open-mobile' })}
            aria-label="Open navigation"
          >
            <Menu size={19} /> Menu
          </button>
          <strong>Housing Value Explorer</strong>
        </header>
        <main className="app-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
