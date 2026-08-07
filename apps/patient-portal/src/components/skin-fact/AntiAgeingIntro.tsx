'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import { loadSkinCommonProfile, loadSkinFactIntake, type SkinFactIntake } from '@/lib/skin-fact/skinJourney';
import styles from './anti-ageing.module.css';

export function AntiAgeingIntro({ preview = false }: { preview?: boolean }) {
  const clinicSlug = preview ? 'preview' : String(useParams().clinicSlug ?? '');
  const router = useRouter();
  const [intake, setIntake] = useState<SkinFactIntake | null>(preview ? {
    productType:'SKIN_FACT',version:'1.0.0',clinicSlug:'preview',patientSessionId:'preview-session',
    intakeId:'preview-intake',selectedConcerns:['ANTI_AGEING'],currentConcernIndex:0,
    completedConcerns:[],assessmentIds:{},status:'IN_PROGRESS',
  } : null);
  useEffect(() => {
    if (preview) return;
    const profile = loadSkinCommonProfile(localStorage, clinicSlug);
    if (!profile?.completedAt) { router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`); return; }
    const journey = loadSkinFactIntake(localStorage, clinicSlug, profile.sessionId);
    if (!journey?.selectedConcerns.includes('ANTI_AGEING')) { router.replace(`/q/${clinicSlug}/skin/concerns`); return; }
    setIntake(journey);
  }, [clinicSlug, preview, router]);
  if (!intake) return null;
  const next = preview ? '/design-preview/skin-fact/anti-ageing/assessment' : `/q/${clinicSlug}/skin/anti-ageing/assessment`;
  return <main className={`${styles.page} ${styles.intro}`}>
    <header className={styles.topbar}><span className={styles.brand}><i>✦</i> DR SKIN FACT</span><span className={styles.step}>Dermatology-led assessment</span></header>
    <section className={styles.introCard}>
      <div className={styles.introCopy}>
        <p className={styles.eyebrow}>Anti‑Ageing · Personalised skin review</p>
        <h1>Understand how your skin is <em>changing.</em></h1>
        <p className={styles.lead}>Share the changes you have noticed, your skin-care history and clear facial images. An authorised clinical team will review the information before any guidance is provided.</p>
        <div className={styles.trust}><span><Stethoscope size={16}/> Clinician reviewed</span><span><ShieldCheck size={16}/> Secure clinical images</span><span><Sparkles size={16}/> About 6–8 minutes</span></div>
        <div><button className={styles.primary} onClick={() => router.push(next)}>Begin Anti‑Ageing Assessment <ArrowRight size={17}/></button></div>
      </div>
      <div className={styles.hero}>
        <Image src="/skin-fact/anti-ageing/hero-editorial.png" alt="Mature woman in a refined lavender editorial portrait" fill priority sizes="(max-width: 760px) 100vw, 50vw"/>
        <div className={styles.heroBadge}><strong>Clinically reviewed</strong><span>No instant diagnosis. No automated prescription. Your answers remain factual until reviewed.</span></div>
      </div>
    </section>
  </main>;
}
