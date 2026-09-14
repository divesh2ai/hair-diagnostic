'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  AssessmentV3Journey,
  LanguageGateV3,
  PatientIntakeGateV3,
  type PatientIntakeResult,
} from '@/components/questionnaire/v3';
import { getProtocolForConcern } from '@/runtime/protocolLoader';
import {
  resolvePersistedAssessmentSession,
  useAssessmentStore,
} from '@/stores/useAssessmentStore';

interface AssessmentV3ClientProps {
  /** Slug from the route. Scopes the intake session the server signs. */
  clinicSlug: string;
  /**
   * Languages this clinic offers, resolved on the server. Passed in rather than
   * read from the persisted store so a patient who deep-links straight to the
   * assessment — QR code, shared link, bookmark — gets the same filtered list
   * as one who arrived via the landing page.
   */
  clinic: { id: string; name: string; language: string; supportedLanguages: string[] } | null;
}

/**
 * HairOS — hair assessment route.
 *
 * Mirrors the skin/acne page's hydration guard, but pins the store to the
 * hair concern. Without this, a persisted `concern: 'skin_acne'` in
 * localStorage (from a previous visit to /skin/acne) would rehydrate the
 * skin protocol and render skin questions on this URL.
 *
 * ── Arrival order ────────────────────────────────────────────────────────────
 *
 *   language  →  identity + visit intent  →  the assessment itself
 *
 * Language leads because every later screen has to be readable. Identity comes
 * next, and deliberately sits *outside* `AssessmentV3Journey`: mobile identity
 * is operational intake data, not a clinical question, so it is not in the
 * protocol and does not touch the question count, the progress model or any
 * branching rule. The journey below is the same component, with the same
 * protocol, localisation, photo flow and submission pipeline as before.
 *
 * `LanguageGateV3` is rendered here rather than left to the journey so the
 * intake gate can speak the patient's language. The journey still contains its
 * own copy of the gate for every other surface that mounts it directly; by the
 * time it renders here the choice is already confirmed, so that branch is a
 * no-op.
 */
export function AssessmentV3Client({ clinic, clinicSlug }: AssessmentV3ClientProps) {
  const concern = useAssessmentStore((state) => state.concern);
  const setConcern = useAssessmentStore((state) => state.setConcern);
  const setClinicData = useAssessmentStore((state) => state.setClinicData);
  const hasChosenLocale = useAssessmentStore((state) => state.hasChosenLocale);
  const intake = useAssessmentStore((state) => state.intake);
  const setIntake = useAssessmentStore((state) => state.setIntake);
  const setAnswer = useAssessmentStore((state) => state.setAnswer);
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

  // Runs after hydration so it overwrites, rather than is overwritten by, a
  // persisted clinicData from a different clinic. The server value is
  // authoritative: this URL's slug decides which clinic's languages apply.
  useEffect(() => {
    if (!hasHydrated || !clinic) return;
    setClinicData({
      id: clinic.id,
      name: clinic.name,
      theme: 'default',
      language: clinic.language,
      supportedLanguages: clinic.supportedLanguages,
    });
  }, [clinic, hasHydrated, setClinicData]);

  useEffect(() => {
    if (hasHydrated && concern !== 'hair') {
      setConcern('hair', getProtocolForConcern('hair'));
    }
  }, [concern, hasHydrated, setConcern]);

  const handleIntakeComplete = useCallback(
    (result: PatientIntakeResult) => {
      setIntake({
        name: result.name,
        phone: result.phone,
        relationship: result.relationship,
        visitType: result.visitType,
        intakeToken: result.intakeToken,
        whatsappConsent: result.whatsappConsent,
      });
      // Seed question one instead of answering it. The patient still sees the
      // name question, prefilled, and can extend "Priya" to "Priya Sharma" —
      // which is why the name is NOT sent as a patientInfo override: the
      // submit route lets an override win over the answer, and the fuller
      // value has to win.
      setAnswer('name', result.name);
    },
    [setAnswer, setIntake],
  );

  if (!hasHydrated || concern !== 'hair') return null;

  // Chapter zero. Self-dismisses when the clinic offers a single language.
  if (!hasChosenLocale) return <LanguageGateV3 />;

  if (!intake) {
    return (
      <PatientIntakeGateV3
        clinicSlug={clinicSlug}
        clinicName={clinic?.name ?? null}
        onComplete={handleIntakeComplete}
      />
    );
  }

  return (
    <AssessmentV3Journey
      visualMode="bridge"
      // Phone (+ consent) only — see `handleIntakeComplete` on why the name
      // travels as a seeded answer instead.
      patientInfoOverride={{ phone: intake.phone, whatsappConsent: intake.whatsappConsent }}
      visitType={intake.visitType}
      // Closes the In Clinic entry opened at intake, in the same server
      // workflow that creates the Assessment.
      intakeToken={intake.intakeToken}
    />
  );
}
