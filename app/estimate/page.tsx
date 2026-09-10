import type { Metadata } from 'next';

import { ValuationWorkspace } from '@/components/valuation-workspace';

export const metadata: Metadata = {
  title: 'Estimate a home',
  description:
    'Apply the completed research model to a supported property profile and inspect its local TreeSHAP explanation.',
};

export default function EstimatePage() {
  return <ValuationWorkspace />;
}
