'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Droplets, ShieldCheck, Sparkles, SunMedium } from 'lucide-react';
import {
  SKIN_CONCERN_ORDER,
  concernRoute,
  createSkinFactIntake,
  loadSkinCommonProfile,
  loadSkinFactIntake,
  skinIntakeStorageKey,
  type SkinConcern,
  type SkinFactIntake,
} from '@/lib/skin-fact/skinJourney';
import { SkinHeader } from './SkinBrand';
import styles from './skin-fact.module.css';

const CONCERNS = [
  { id: 'ACNE', title: 'Acne', copy: 'Breakouts, congestion and acne-related concerns', icon: Droplets, tone: 'acne', art: '/skin-fact/common-intake/card-acne.webp' },
  { id: 'PIGMENTATION', title: 'Pigmentation', copy: 'Dark marks, uneven tone and pigmentation concerns', icon: SunMedium, tone: 'pigmentation', art: '/skin-fact/common-intake/card-pigmentation.webp?v=2' },
  { id: 'ANTI_AGEING', title: 'Anti-Ageing', copy: 'Fine lines, wrinkles, pores and visible skin-ageing concerns', icon: Sparkles, tone: 'antiAgeing', art: '/skin-fact/common-intake/card-anti-ageing.webp' },
] as const;

const LABELS: Record<SkinConcern, string> = {
  ACNE: 'Acne',
  PIGMENTATION: 'Pigmentation',
  ANTI_AGEING: 'Anti-Ageing',
};

export function SkinConcernMultiSelect({ clinicSlug }: { clinicSlug: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [existing, setExisting] = useState<SkinFactIntake | null>(null);
  const [selected, setSelected] = useState<SkinConcern[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const profile = loadSkinCommonProfile(localStorage, clinicSlug);
    if (!profile?.completedAt) {
      router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`);
      return;
    }
    const saved = loadSkinFactIntake(localStorage, clinicSlug, profile.sessionId);
    setProfileId(profile.sessionId);
    setExisting(saved);
    setSelected(saved?.selectedConcerns ?? []);
    setLoaded(true);
  }, [clinicSlug, router]);

  const ordered = useMemo(
    () => SKIN_CONCERN_ORDER.filter((concern) => selected.includes(concern)),
    [selected],
  );

  function toggle(concern: SkinConcern) {
    setError('');
    const removing = selected.includes(concern);
    if (removing && existing?.completedConcerns.includes(concern)) {
      setError(`${LABELS[concern]} has already been submitted and cannot be removed from this journey.`);
      return;
    }
    if (removing && existing?.status === 'IN_PROGRESS') {
      const confirmed = window.confirm(
        `${LABELS[concern]} has a journey in progress. Remove it from the remaining sequence? Saved answers will not be deleted.`,
      );
      if (!confirmed) return;
    }
    setSelected((current) =>
      current.includes(concern)
        ? current.filter((item) => item !== concern)
        : [...current, concern],
    );
  }

  function continueJourney() {
    if (!ordered.length) {
      setError('Select at least one concern to continue.');
      return;
    }
    const intake = createSkinFactIntake(clinicSlug, profileId, ordered, existing);
    const started: SkinFactIntake = {
      ...intake,
      status: intake.status === 'NOT_STARTED' ? 'IN_PROGRESS' : intake.status,
      startedAt: intake.startedAt ?? new Date().toISOString(),
    };
    localStorage.setItem(skinIntakeStorageKey(clinicSlug, profileId), JSON.stringify(started));
    router.push(concernRoute(clinicSlug, started.selectedConcerns[started.currentConcernIndex]));
  }

  if (!loaded) return null;
  const count = ordered.length;
  const cta = count === 0
    ? 'Continue'
    : count === 1
      ? `Continue with ${LABELS[ordered[0]]}`
      : count === 3
        ? 'Continue with all 3 concerns'
        : `Continue with ${count} concerns`;

  return <div className={`${styles.scope} ${styles.concernSelectionRoot} ${styles.commonIntakeBackground}`}><span className={styles.commonBubbleField} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
    <SkinHeader clinicSlug={clinicSlug} compact />
    <div className={styles.concernHeaderMeta} aria-hidden="true"><span className={styles.finalStepBadge}>Final step</span><span className={styles.secureMeta}><ShieldCheck size={22}/><span><strong>Secure &amp; Confidential</strong><small>Your data is safe with us.</small></span></span></div>
    <div className={styles.commonIntakeProgress} role="progressbar" aria-label="Common intake step 3 of 3" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}><i /></div>
    <main className={`${styles.container} ${styles.page} ${styles.concernSelectionPage}`}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Your concerns · Step 3 of 3</p>
        <h1 className={styles.serif}>What would you like help with?</h1>
        <p className={styles.concernDesktopCopy}>Select one or more concerns. We’ll guide you through a separate, focused assessment for each.</p>
        <p className={styles.concernMobileCopy}>Select all that apply.</p>
      </header>

      <div className={styles.concernGrid} role="group" aria-label="Skin concerns">
        {CONCERNS.map(({ id, title, copy, icon: Icon, tone, art }) => {
          const isSelected = selected.includes(id);
          return <button
            key={id}
            className={`${styles.concernCard} ${styles[`concernCard_${tone}`]} ${isSelected ? styles.concernCardSelected : ''}`}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${title}${isSelected ? ', Selected' : ''}`}
            onClick={() => toggle(id)}
          >
            <img className={styles.concernCardArt} src={art} alt="" width={1536} height={1024} decoding="async" aria-hidden="true" />
            <span className={styles.concernArtwork} aria-hidden="true"><i /><i /><i /></span>
            {isSelected && <span className={styles.selectedBadge}><Check size={13} /> Selected</span>}
            <span className={styles.concernIcon}><Icon size={25} strokeWidth={1.6} /></span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </button>;
        })}
      </div>

      <div className={styles.concernContinue}>
        <div className={styles.sequencePreview} aria-live="polite">
          {count > 1 && <><span>You’ll complete:</span><strong>{ordered.map((item) => LABELS[item]).join(' → ')}</strong></>}
        </div>
        {error && <p className={styles.concernError} role="alert">{error}</p>}
        <button className={styles.button} type="button" disabled={!count} onClick={continueJourney}>
          {cta} <ArrowRight size={16} />
        </button>
        <p className={styles.concernReviewNote}>You can review each concern separately.</p>
      </div>
    </main>
  </div>;
}
