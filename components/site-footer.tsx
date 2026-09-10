import Link from 'next/link';

export function SiteFooter() {
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
        <Link href="/research">Methods & limitations</Link>
        <Link href="/data/source-manifest.json">Data provenance</Link>
      </div>
    </footer>
  );
}
