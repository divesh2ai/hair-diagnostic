import type { Metadata } from 'next';

import { BiologicalBridgeStudio } from './BiologicalBridgeStudio';

export const metadata: Metadata = {
  title: 'Biological Bridge · Design Preview · Dr. FACT',
  description:
    'Isolated approval prototype for the Dr. FACT biological-bridge hero and assessment-progress concept.',
};

export default function BiologicalBridgePreviewPage() {
  return <BiologicalBridgeStudio />;
}
