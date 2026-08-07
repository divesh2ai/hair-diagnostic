import SkinAcneAssessmentPage from '@/app/q/[clinicSlug]/skin/acne/page';

/**
 * Stable Skin FACT product URL for the current acne protocol.
 *
 * The protocol/session implementation remains mounted without redirecting
 * back into the public HairOS URL tree, so links and refreshes preserve the
 * Skin FACT route while the dedicated visual shell is completed.
 */
export default function SkinFactAcneAssessmentPage() {
  return <SkinAcneAssessmentPage />;
}
