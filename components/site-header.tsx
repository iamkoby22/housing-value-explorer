'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/', label: 'Overview' },
  { href: '/explore', label: 'Explore' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/model', label: 'Model' },
  { href: '/research', label: 'Research' },
];

export function SiteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith('/evaluate')) return null;

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="header-inner">
        <Link
          className="wordmark"
          href="/"
          aria-label="Unboxing the Black Box home"
        >
          <span className="wordmark-mark">UB</span>
          <span>
            <strong>Housing Value Explorer</strong>
            <small>ACS PUMS · 2020–2024</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
