'use client';

import { useRouter } from 'next/navigation';
import { Clock3, Droplets, Sparkles, SunMedium } from 'lucide-react';
import { SkinHeader } from './SkinBrand';
import styles from './skin-fact.module.css';

const concerns = [
  { id: 'acne', title: 'Acne', copy: 'Breakouts, congestion, redness, and post-acne marks.', icon: Droplets, enabled: true },
  { id: 'pigmentation', title: 'Pigmentation', copy: 'Melasma, sun spots, and uneven skin tone.', icon: SunMedium, enabled: true },
  { id: 'anti-ageing', title: 'Anti-ageing', copy: 'Fine lines, firmness, texture, and luminosity.', icon: Sparkles, enabled: false },
] as const;

export function SkinConcernPicker({ clinicSlug }: { clinicSlug: string }) {
  const router = useRouter();
  return (
    <div className={styles.scope}>
      <SkinHeader clinicSlug={clinicSlug} compact />
      <main className={`${styles.container} ${styles.page}`}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>Skin assessment</p>
          <h1 className={styles.serif}>What is your primary skin concern?</h1>
          <p className={styles.muted}>Choose one concern so your questions, uploads, and clinical review stay focused.</p>
        </header>
        <div className={styles.concernGrid}>
          {concerns.map(({ id, title, copy, icon: Icon, enabled }) => (
            <button key={id} className={styles.concernCard} type="button" disabled={!enabled} onClick={() => enabled && router.push(id === 'pigmentation' ? `/q/${clinicSlug}/skin/pigmentation` : `/skin/${clinicSlug}/assessment/${id}`)}>
              {!enabled && <span className={styles.chip}><Clock3 size={11} /> Coming next</span>}
              <span className={styles.concernIcon}><Icon size={24} strokeWidth={1.6} /></span>
              <h2>{title}</h2><p>{copy}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
