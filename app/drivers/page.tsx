import type { Metadata } from 'next';

import { AnalysisWorkspace } from '@/components/analysis-workspace';

export const metadata: Metadata = {
  title: 'Drivers',
  description: 'Understand the features shaping model predictions.',
};

export default function DriversPage() {
  return <AnalysisWorkspace scope="drivers" />;
}
