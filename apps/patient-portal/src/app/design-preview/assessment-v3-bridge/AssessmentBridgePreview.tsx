'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { AssessmentV3Journey } from '@/components/questionnaire/v3';
import { useAssessmentStore } from '@/stores/useAssessmentStore';

import styles from './preview.module.css';

export type PreviewView = 'desktop' | 'mobile' | 'responsive';

const DEFAULT_CLINIC_SLUG = 'drfact-mumbai';

interface Props {
  view: PreviewView;
  clinicSlug?: string;
}

interface ClinicResponse {
  success: boolean;
  clinic?: {
    id: string;
    name: string;
    slug: string;
    language: string;
  };
  error?: string;
}

export function AssessmentBridgePreview({ view, clinicSlug }: Props) {
  const setClinicData = useAssessmentStore((s) => s.setClinicData);
  const clinicData = useAssessmentStore((s) => s.clinicData);
  const reset = useAssessmentStore((s) => s.reset);
  const isSubmitting = useAssessmentStore((s) => s.isSubmitting);

  const effectiveSlug = clinicSlug ?? DEFAULT_CLINIC_SLUG;

  const [bootStatus, setBootStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loadClinic = useCallback(async () => {
    setBootStatus('loading');
    setBootError(null);
    try {
      const response = await fetch(`/api/clinics/${effectiveSlug}`);
      const data: ClinicResponse = await response.json();
      if (!response.ok || !data.success || !data.clinic) {
        throw new Error(data.error ?? `Clinic not found (HTTP ${response.status})`);
      }
      setClinicData({
        id: data.clinic.id,
        name: data.clinic.name,
        theme: 'default',
        language: data.clinic.language,
      });
      setBootStatus('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load clinic.';
      setBootError(message);
      setBootStatus('error');
    }
  }, [effectiveSlug, setClinicData]);

  useEffect(() => {
    // Load the clinic on mount / when the slug changes / on manual retry.
    // Do not reset answers on load — reviewers may want to pick up where they left off.
    loadClinic();
  }, [loadClinic, attempt]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  if (bootStatus !== 'ready') {
    return (
      <main className={styles.boot}>
        <div className={styles.bootInner}>
          <strong>Assessment V3 · Biological bridge preview</strong>
          {bootStatus === 'loading' ? (
            <p>Loading clinic <code>{effectiveSlug}</code>…</p>
          ) : (
            <>
              <p className={styles.bootError}>
                {bootError ?? 'Could not load the demo clinic.'}
              </p>
              <button
                type="button"
                className={styles.bootRetry}
                onClick={() => setAttempt((n) => n + 1)}
              >
                Retry
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  const frameClass =
    view === 'mobile'
      ? styles.mobileFrame
      : view === 'desktop'
        ? styles.desktopFrame
        : styles.responsiveFrame;

  return (
    <div className={styles.host}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span>DESIGN PREVIEW · Isolated assessment prototype</span>
          <strong>Assessment V3 · Biological bridge</strong>
          {clinicData?.name && (
            <span className={styles.brandClinic}>
              Clinic: {clinicData.name} · {effectiveSlug}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
            disabled={isSubmitting}
            title="Clear answers and start the assessment from the first question"
          >
            Restart flow
          </button>
          <nav className={styles.viewSwitch} aria-label="Viewport preview">
            <Link
              className={`${styles.viewLink} ${view === 'desktop' ? styles.viewLinkActive : ''}`}
              href={buildHref('desktop', clinicSlug)}
              scroll={false}
              aria-current={view === 'desktop' ? 'page' : undefined}
            >
              Desktop
            </Link>
            <Link
              className={`${styles.viewLink} ${view === 'mobile' ? styles.viewLinkActive : ''}`}
              href={buildHref('mobile', clinicSlug)}
              scroll={false}
              aria-current={view === 'mobile' ? 'page' : undefined}
            >
              Mobile
            </Link>
            <Link
              className={`${styles.viewLink} ${view === 'responsive' ? styles.viewLinkActive : ''}`}
              href={buildHref('responsive', clinicSlug)}
              scroll={false}
              aria-current={view === 'responsive' ? 'page' : undefined}
            >
              Responsive
            </Link>
          </nav>
        </div>
      </header>

      <section className={styles.stage} aria-label={`${view} assessment preview`}>
        <div className={frameClass}>
          <AssessmentV3Journey
            visualMode="bridge"
            clinicSlugOverride={effectiveSlug}
            compactProgress={view === 'mobile'}
            compactShell={view === 'mobile'}
          />
        </div>
      </section>
    </div>
  );
}

function buildHref(view: PreviewView, clinicSlug?: string): string {
  const params = new URLSearchParams();
  if (view !== 'responsive') params.set('view', view);
  if (clinicSlug) params.set('clinic', clinicSlug);
  const query = params.toString();
  return query ? `?${query}` : `?`;
}
