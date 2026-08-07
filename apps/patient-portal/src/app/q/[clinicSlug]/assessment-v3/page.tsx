'use client';

import { useEffect, useState } from 'react';

import { AssessmentV3Journey } from '@/components/questionnaire/v3';
import { getProtocolForConcern } from '@/runtime/protocolLoader';
import {
  resolvePersistedAssessmentSession,
  useAssessmentStore,
} from '@/stores/useAssessmentStore';

/**
 * HairOS — hair assessment route.
 *
 * Mirrors the skin/acne page's hydration guard, but pins the store to the
 * hair concern. Without this, a persisted `concern: 'skin_acne'` in
 * localStorage (from a previous visit to /skin/acne) would rehydrate the
 * skin protocol and render skin questions on this URL.
 */
export default function AssessmentV3Page() {
  const concern = useAssessmentStore((state) => state.concern);
  const setConcern = useAssessmentStore((state) => state.setConcern);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const persistence = useAssessmentStore.persist;
    const hydration = persistence ? persistence.rehydrate() : Promise.resolve();
    void Promise.resolve(hydration).finally(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem('drfact-assessment-storage');
        const persisted = raw ? JSON.parse(raw)?.state : null;
        if (persisted?.concern === 'hair') {
          useAssessmentStore.setState(resolvePersistedAssessmentSession(persisted));
        }
      } catch {
        // Malformed / blocked storage falls back to a fresh hair session below.
      }
      setHasHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasHydrated && concern !== 'hair') {
      setConcern('hair', getProtocolForConcern('hair'));
    }
  }, [concern, hasHydrated, setConcern]);

  if (!hasHydrated || concern !== 'hair') return null;

  return <AssessmentV3Journey visualMode="bridge" />;
}
