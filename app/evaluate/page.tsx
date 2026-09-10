import type { Metadata } from 'next';

import { AnalysisWorkspace } from '@/components/analysis-workspace';

export const metadata: Metadata = {
  title: 'Evaluate the research',
  description:
    'Interactive housing, geography, model-evaluation, and SHAP workspace for the completed study.',
};

export default function EvaluatePage() {
  return <AnalysisWorkspace />;
}
