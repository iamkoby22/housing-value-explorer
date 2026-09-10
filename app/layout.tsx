import type { Metadata } from 'next';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Unboxing the Black Box — Housing Value Explorer',
    template: '%s — Housing Value Explorer',
  },
  description:
    'Geographic variation in machine-learning explanations of housing value across five U.S. states using ACS PUMS.',
  openGraph: {
    title: 'Unboxing the Black Box',
    description:
      'Geographic variation in machine-learning explanations of U.S. housing values.',
    images: [{ url: '/og-research.svg', width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
