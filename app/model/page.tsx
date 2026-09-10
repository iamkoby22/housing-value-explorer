import type { Metadata } from 'next';

import { AnalysisWorkspace } from '@/components/analysis-workspace';

export const metadata: Metadata = {
  title: 'Model',
  description: 'Inspect model development, validation, and diagnostics.',
};

export default function ModelPage() {
  return <AnalysisWorkspace scope="model" />;
}
