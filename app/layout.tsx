import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Unboxing the Black Box — Housing Value Explorer',
    template: '%s — Housing Value Explorer',
  },
  description:
    'Geographic variation in machine-learning explanations of housing value across five U.S. states using ACS PUMS.',
  icons: { icon: '/housing-value-explorer-logo.png' },
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
