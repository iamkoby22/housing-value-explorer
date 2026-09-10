'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/evaluate')) return null;

  return (
    <footer className="site-footer">
      <div>
        <strong>Unboxing the Black Box</strong>
        <p>
          Research presentation of ACS PUMS housing-value modeling across five
          states.
        </p>
      </div>
      <div className="footer-links">
        <Link href="/evaluate">Evaluate the research</Link>
        <Link href="/research">Methods & limitations</Link>
        <Link href="/data/source-manifest.json">Data provenance</Link>
      </div>
    </footer>
  );
}
