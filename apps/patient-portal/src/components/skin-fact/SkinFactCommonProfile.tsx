'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import {
  emptySkinCommonAnswers,
  loadSkinCommonProfile,
  skinCommonStorageKey,
  type SkinCommonAnswers,
  type SkinCommonProfile,
} from '@/lib/skin-fact/skinJourney';
import { normaliseMobile } from '@/lib/patient/phone';
import styles from './pigmentation.module.css';

const SCREENS = [
  { title: 'Let’s start with a few details', phase: 'About You' },
  { title: 'How would you describe your skin?', phase: 'Your Skin' },
] as const;

export function SkinFactCommonProfile() {
  const clinicSlug = String(useParams().clinicSlug ?? '');
  const router = useRouter();
  const query = useSearchParams();
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<SkinCommonProfile>({
    productType: 'SKIN_FACT',
    intakeType: 'COMMON',
    version: '2.0.0',
    clinicSlug,
    sessionId: '',
    answers: emptySkinCommonAnswers(),
  });

  // `?start=1` means "a new patient is starting here" — only the Skin FACT
  // landing CTAs set it. Every other arrival (the Edit-profile link, and the
  // guard redirects that seven skin screens fire when a profile is missing)
  // rehydrates instead.
  //
  // The distinction matters because `intake?next=concerns` is also the target
  // of browser Back from the concern picker. Resetting on every mount wiped a
  // completed profile and minted a fresh sessionId, which additionally orphaned
  // the skin intake keyed to the old session. The flag is consumed immediately
  // so the history entry Back returns to no longer carries it.
  // Runs once per clinic. `query` is a fresh object on every render, so an
  // unguarded effect re-seeds state — including `setStep(0)` — whenever the URL
  // object changes, which the `start` cleanup below deliberately does.
  const initialisedFor = useRef<string | null>(null);
  useEffect(() => {
    if (initialisedFor.current === clinicSlug) return;
    initialisedFor.current = clinicSlug;
    const fresh = query.get('start') === '1';
    const saved = fresh ? null : loadSkinCommonProfile(localStorage, clinicSlug);
    setProfile(saved ?? {
      productType: 'SKIN_FACT',
      intakeType: 'COMMON',
      version: '2.0.0',
      clinicSlug,
      sessionId: crypto.randomUUID(),
      answers: emptySkinCommonAnswers(),
    });
    setStep(0);
    setLoaded(true);
    if (fresh) {
      const rest = new URLSearchParams(query);
      rest.delete('start');
      const suffix = rest.toString();
      router.replace(`/q/${clinicSlug}/skin/intake${suffix ? `?${suffix}` : ''}`);
    }
  }, [clinicSlug, query, router]);

  useEffect(() => {
    if (loaded && profile.sessionId) {
      localStorage.setItem(skinCommonStorageKey(clinicSlug), JSON.stringify(profile));
    }
  }, [clinicSlug, loaded, profile]);

  const answer = (key: keyof SkinCommonAnswers, value: string) =>
    setProfile((current) => ({
      ...current,
      completedAt: undefined,
      answers: { ...current.answers, [key]: value },
    }));

  const setWhatsappConsent = (value: boolean) =>
    setProfile((current) => ({
      ...current,
      completedAt: undefined,
      answers: { ...current.answers, whatsappConsent: value },
    }));

  function nextRoute() {
    const returnTo = query.get('returnTo');
    if (returnTo?.startsWith(`/q/${clinicSlug}/skin/`)) return returnTo;
    const requested = query.get('next');
    return `/q/${clinicSlug}/skin/concerns${requested && ['acne', 'pigmentation', 'anti-ageing'].includes(requested) ? `?preselect=${requested}` : ''}`;
  }

  function validate() {
    const next: Record<string, string> = {};
    if (step === 0) {
      if (profile.answers.name.trim().length < 2) next.name = 'Enter the patient name.';
      const age = Number(profile.answers.age);
      if (!Number.isInteger(age) || age < 10 || age > 150) next.age = 'Enter an age between 10 and 150.';
      if (!profile.answers.gender) next.gender = 'Choose a gender option.';
      const phoneResult = normaliseMobile(profile.answers.phone);
      if (!phoneResult.ok) next.phone = 'Enter a valid 10-digit mobile number.';
    } else {
      if (!profile.answers.skinType) next.skinType = 'Choose a skin type.';
      if (!profile.answers.sensitiveSkin) next.sensitiveSkin = 'Choose a sensitivity option.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function continueFlow() {
    if (!validate()) return;
    if (step === 0) {
      setStep(1);
      return;
    }
    const completed = { ...profile, completedAt: new Date().toISOString() };
    localStorage.setItem(skinCommonStorageKey(clinicSlug), JSON.stringify(completed));
    router.push(nextRoute());
  }

  if (!loaded) return <main className={styles.loading}>Loading secure intake…</main>;
  const screen = SCREENS[step];
  return <div className={`${styles.shell} ${styles.commonShell}`}><CommonBubbleField />
    <header className={styles.topbar}><div><span className={styles.brandMark}><Sparkles size={15} /></span><strong>DR SKIN FACT</strong></div><span>SHARED PROFILE</span></header>
    <div className={styles.progress} aria-label={`Common entry step ${step + 1} of 3`}><i style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
    <main className={styles.questionPage} key={step}>
      <p className={styles.eyebrow}>{screen.phase} · Step {step + 1} of 3</p>
      <h1>{screen.title}</h1>
      {step === 1 && <p className={styles.questionInstruction}>These choices describe your skin and do not create a diagnosis.</p>}
      <section className={styles.formCard}>
        {step === 0 ? <>
          <Field label="What is your name?" error={errors.name}><input value={profile.answers.name} onChange={(event) => answer('name', event.target.value)} autoComplete="name" /></Field>
          <Field label="What is your age?" error={errors.age}><input type="number" min="10" max="150" value={profile.answers.age} onChange={(event) => answer('age', event.target.value)} inputMode="numeric" /></Field>
          <Choice label="How do you describe your gender?" value={profile.answers.gender} options={['Female', 'Male', 'Another identity', 'Prefer not to say']} onChange={(value) => answer('gender', value)} error={errors.gender} />
          <Field label="Mobile number" error={errors.phone}><input type="tel" inputMode="numeric" value={profile.answers.phone} onChange={(event) => answer('phone', event.target.value)} autoComplete="tel-national" placeholder="98765 43210" /></Field>
          <label className={styles.consentRow}>
            <input type="checkbox" checked={profile.answers.whatsappConsent} onChange={(event) => setWhatsappConsent(event.target.checked)} />
            <span>I agree to receive my Dr FACT assessment report and related care information on WhatsApp at the mobile number provided.</span>
          </label>
        </> : <>
          <Choice label="How would you describe your skin type?" value={profile.answers.skinType} options={['Dry', 'Oily', 'Combination', 'Normal', 'Not sure']} onChange={(value) => answer('skinType', value)} error={errors.skinType} />
          <Choice label="Do you have sensitive skin?" value={profile.answers.sensitiveSkin} options={['Yes', 'No', 'Not sure']} onChange={(value) => answer('sensitiveSkin', value)} error={errors.sensitiveSkin} />
        </>}
      </section>
    </main>
    <footer className={styles.footer}>
      <span><ShieldCheck size={14} /> Your progress is saved securely</span>
      <div>
        <button className={styles.secondary} onClick={() => step ? setStep(0) : router.back()}><ArrowLeft size={16} /> Back</button>
        <button className={styles.primary} onClick={continueFlow}>{step ? 'Choose my concern' : 'Continue'} <ArrowRight size={16} /></button>
      </div>
    </footer>
  </div>;
}

function CommonBubbleField() {
  return <span className={styles.commonBubbleField} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{error && <small className={styles.error}>{error}</small>}</label>;
}

function Choice({ label, value, options, onChange, error }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; error?: string;
}) {
  return <fieldset className={styles.choiceField}><legend>{label}</legend><div className={styles.choiceGrid}>
    {options.map((option) => <button type="button" role="radio" aria-checked={value === option} key={option} className={value === option ? styles.selected : ''} onClick={() => onChange(option)}>
      {value === option ? <Check size={16} /> : <Sparkles size={15} />}<span>{option}</span>
    </button>)}
  </div>{error && <small className={styles.error}>{error}</small>}</fieldset>;
}
