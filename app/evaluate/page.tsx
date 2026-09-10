import type { Metadata } from 'next';

import { LegacyEvaluateRedirect } from '@/components/legacy-evaluate-redirect';

export const metadata: Metadata = {
  title: 'Evaluate the research',
  description:
    'Interactive housing, geography, model-evaluation, and SHAP workspace for the completed study.',
};

export default function EvaluatePage() {
  return <LegacyEvaluateRedirect />;
}
