import type { Metadata } from 'next';

import { AnalysisWorkspace } from '@/components/analysis-workspace';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Interact with housing, geographic, and model-derived patterns.',
};

export default function ExplorePage() {
  return <AnalysisWorkspace scope="explore" />;
}
