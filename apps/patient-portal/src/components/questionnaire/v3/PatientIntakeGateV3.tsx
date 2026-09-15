'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

import { useAssessmentTranslator } from '@/lib/assessment-i18n';
import { normaliseMobile, type PhoneRejection } from '@/lib/patient/phone';
import {
  RETURNING_VISIT_TYPES,
  type ReturningVisitType,
  type VisitType,
} from '@/lib/patient/visit';

import styles from './PatientIntakeGateV3.module.css';

/**
 * Pre-assessment intake.
 *
 * Mobile identity is operational intake data, not a clinical question. It lives
 * here — before `AssessmentV3Journey` — rather than in the protocol, so the
 * questionnaire keeps its own question count, progress model, branching and
 * localisation untouched. Nothing on this screen is an AssessmentResponse row.
 *
 * Two steps:
 *
 *   1. name + mobile  → server-side relationship lookup
 *   2. visit intent   → returning patients only; a new patient has nothing to
 *                       be asked, their visit is INITIAL by definition
 *
 * ── What the lookup is allowed to tell us ────────────────────────────────────
 * `NEW` or `RETURNING`, and nothing else. The endpoint deliberately withholds
 * name, dates, visit counts and every clinical value, and it collapses "one
 * match" and "several matches" into the same RETURNING answer — so this
 * component cannot show a returning patient's history even by accident, and
 * cannot be used to discover that a number appears on more than one record.
 *
 * The answer is provisional in every case. Identity is re-resolved server-side
 * at submission, which is the only place it is binding.
 */

const CONTINUE_WITHOUT_CHECK_AFTER_FAILURES = 2;

/**
 * The server reported that identity lookup is not available — not that it could
 * not be reached.
 *
 * The distinction decides two things the patient experiences directly: whether
 * we blame their connection, and whether we offer to carry on without the
 * check. We do neither here, because `/api/assessment/submit` resolves identity
 * through the same schema. Waving the patient past this screen would hand them
 * twenty questions and then lose the submission, which is a far worse failure
 * than stopping at the first screen.
 */
class LookupUnavailableError extends Error {
  constructor() {
    super('IDENTITY_LOOKUP_UNAVAILABLE');
    this.name = 'LookupUnavailableError';
  }
}

export interface PatientIntakeResult {
  /** As typed. Seeds question one rather than replacing it. */
  name: string;
  /** Canonical E.164. */
  phone: string;
  /**
   * Provisional relationship from the lookup, or null when the lookup could
   * not be completed. Advisory only — the server re-resolves at submission.
   */
  relationship: 'NEW' | 'RETURNING' | null;
  /** Null when the relationship is unknown; there is nothing honest to record. */
  visitType: VisitType | null;
  /**
   * The signed intake session this visit was opened under, or null when no
   * session could be issued. Carried to submission so the server can close the
   * matching ClinicVisit — the patient leaves the Doctor Dashboard's In Clinic
   * list at the same moment their assessment enters the Review Queue.
   *
   * Opaque to the client: it is read, and its clinic scope enforced, only on
   * the server.
   */
  intakeToken: string | null;
  /**
   * Explicit opt-in to receive the report and care updates on WhatsApp at
   * `phone`. Defaults false — never inferred from typing a mobile number,
   * never pre-checked. See lib/patient/whatsappConsent.ts, the module that
   * persists it and the one place automated delivery reads it.
   */
  whatsappConsent: boolean;
}

interface PatientIntakeGateV3Props {
  clinicSlug: string;
  clinicName: string | null;
  onComplete: (result: PatientIntakeResult) => void;
}

type Step = 'details' | 'intent';

/** Dictionary key for each phone rejection, so the message follows the locale. */
const PHONE_ERROR_KEY = {
  empty: 'intake.phoneEmpty',
  too_short: 'intake.phoneTooShort',
  too_long: 'intake.phoneTooLong',
  not_a_mobile: 'intake.phoneNotAMobile',
  malformed: 'intake.phoneMalformed',
} as const satisfies Record<PhoneRejection, string>;

const INTENT_LABEL_KEY = {
  FOLLOW_UP: 'intake.intentFollowUp',
  KIT_FULFILMENT: 'intake.intentKitFulfilment',
  CONDITION_CHANGED: 'intake.intentConditionChanged',
  NEW_CONCERN: 'intake.intentNewConcern',
  REASSESSMENT: 'intake.intentReassessment',
} as const satisfies Record<ReturningVisitType, string>;

// Letters, spaces and the punctuation Indian names actually contain. Mirrors
// the server's own sanitiser in api/assessment/submit so a name accepted here
// is not silently rewritten there.
const NAME_ALLOWED = /^[A-Za-zऀ-ॿ\s.'-]+$/;

export function PatientIntakeGateV3({
  clinicSlug,
  clinicName,
  onComplete,
}: PatientIntakeGateV3Props) {
  const { t, locale } = useAssessmentTranslator();

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [intent, setIntent] = useState<ReturningVisitType | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  /** Opt-in only — starts false, and nothing in this component ever sets it true except the checkbox itself. */
  const [whatsappConsent, setWhatsappConsent] = useState(false);

  // Resolved once the lookup succeeds; kept so step 2 can complete without
  // re-running it.
  const resolvedPhone = useRef<string>('');

  // The signed intake session. Cached across retries so a mistyped number costs
  // one lookup, not a fresh session as well. Held in a ref rather than state
  // because nothing renders from it.
  const sessionToken = useRef<string | null>(null);

  // `busy` drives the UI; this ref is what actually makes a second submit a
  // no-op. State updates are async, so a fast double-tap can enter the handler
  // twice before the first `setBusy(true)` has been applied.
  const inFlight = useRef(false);

  // A token is scoped to one clinic server-side. If the slug changes under us,
  // the cached token is for the wrong clinic and must not be reused.
  useEffect(() => {
    sessionToken.current = null;
  }, [clinicSlug]);

  const openSession = useCallback(async (): Promise<string> => {
    if (sessionToken.current) return sessionToken.current;
    const response = await fetch('/api/patient/intake/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicSlug }),
    });
    const data = await response.json();
    if (!response.ok || !data.success || typeof data.token !== 'string') {
      throw new Error(data.error ?? `Session failed (HTTP ${response.status})`);
    }
    sessionToken.current = data.token;
    return data.token;
  }, [clinicSlug]);

  /**
   * Ask the server whether this clinic has seen this number.
   *
   * Retries exactly once on a 401, which is what an expired session looks like
   * — a patient who left the tablet mid-intake and came back. Any other
   * failure is surfaced rather than swallowed: silently treating an unreachable
   * server as "new patient" would file a returning patient's visit as a first
   * one, which is precisely the mistake this flow exists to stop.
   */
  const lookupRelationship = useCallback(
    async (e164: string): Promise<'NEW' | 'RETURNING'> => {
      const attempt = async (token: string) => {
        const response = await fetch('/api/patient/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, phone: e164 }),
        });
        return { response, data: await response.json() };
      };

      let { response, data } = await attempt(await openSession());

      if (response.status === 401) {
        sessionToken.current = null;
        ({ response, data } = await attempt(await openSession()));
      }

      // Not reachable-but-broken; deliberately unavailable. Retrying is
      // pointless until an operator applies the migration, so this is raised as
      // its own type rather than folded into the generic failure count.
      if (data?.code === 'IDENTITY_LOOKUP_UNAVAILABLE') {
        throw new LookupUnavailableError();
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `Lookup failed (HTTP ${response.status})`);
      }
      return data.relationship === 'RETURNING' ? 'RETURNING' : 'NEW';
    },
    [openSession],
  );

  /**
   * Tell the clinic a named patient has started.
   *
   * Not awaited, and its result is never checked. The patient's next screen is
   * question one; making them wait on a waiting-room list, or showing them an
   * error about one, would be the tail wagging the dog. If it fails the
   * dashboard simply shows one fewer in-clinic patient, and the assessment —
   * the thing that actually matters — is untouched.
   */
  const openVisit = useCallback((token: string | null, displayName: string) => {
    if (!token) return;
    void fetch('/api/patient/intake/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, displayName }),
      // The patient navigates away the instant this fires; keepalive is what
      // stops the browser cancelling it mid-flight.
      keepalive: true,
    }).catch(() => {});
  }, []);

  const submitDetails = useCallback(async () => {
    if (inFlight.current) return;

    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const phoneResult = normaliseMobile(phone);

    const nextNameError = !trimmedName
      ? t('intake.nameRequired')
      : !NAME_ALLOWED.test(trimmedName)
        ? t('intake.nameInvalid')
        : null;
    const nextPhoneError = phoneResult.ok ? null : t(PHONE_ERROR_KEY[phoneResult.reason]);

    setNameError(nextNameError);
    setPhoneError(nextPhoneError);
    if (nextNameError || nextPhoneError || !phoneResult.ok) return;

    inFlight.current = true;
    setBusy(true);
    try {
      const relationship = await lookupRelationship(phoneResult.e164);
      resolvedPhone.current = phoneResult.e164;
      setFailures(0);
      setUnavailable(false);

      // Identity captured. From here the clinic can see that this person is
      // in the room, whichever branch they take next — a returning patient
      // choosing an intent has not stopped being present.
      openVisit(sessionToken.current, trimmedName);

      if (relationship === 'NEW') {
        // Nothing to ask. A clinic that has never seen this number is seeing
        // this patient for the first time, so the intent is derivable.
        onComplete({
          name: trimmedName,
          phone: phoneResult.e164,
          relationship: 'NEW',
          visitType: 'INITIAL',
          intakeToken: sessionToken.current,
          whatsappConsent,
        });
        return;
      }
      setStep('intent');
    } catch (error) {
      if (error instanceof LookupUnavailableError) {
        // Not the patient's fault and not their problem to retry around. Kept
        // out of the transient failure count so the "continue without this
        // step" escape never appears for it.
        setUnavailable(true);
      } else {
        console.error('[INTAKE] lookup failed:', error);
        setFailures((count) => count + 1);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [lookupRelationship, name, onComplete, openVisit, phone, t, whatsappConsent]);

  /**
   * Escape hatch after repeated network failures.
   *
   * The patient keeps the details they typed and goes on to the assessment;
   * `relationship` and `visitType` stay null because neither was established.
   * The server still resolves identity properly at submission — the only thing
   * lost is the stated intent, which is recorded as absent rather than guessed.
   */
  const continueWithoutCheck = useCallback(() => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const phoneResult = normaliseMobile(phone);
    if (!trimmedName || !phoneResult.ok) return;
    // The lookup failed, not the intake. A named patient is still sitting in
    // the clinic, and that is the only thing the visit records.
    openVisit(sessionToken.current, trimmedName);
    onComplete({
      name: trimmedName,
      phone: phoneResult.e164,
      relationship: null,
      visitType: null,
      intakeToken: sessionToken.current,
      whatsappConsent,
    });
  }, [name, onComplete, openVisit, phone, whatsappConsent]);

  const submitIntent = useCallback(() => {
    if (!intent) {
      setIntentError(t('intake.intentRequired'));
      return;
    }
    onComplete({
      name: name.trim().replace(/\s+/g, ' '),
      phone: resolvedPhone.current,
      relationship: 'RETURNING',
      visitType: intent,
      // Already opened when the lookup succeeded, one step back.
      intakeToken: sessionToken.current,
      whatsappConsent,
    });
  }, [intent, name, onComplete, t, whatsappConsent]);

  const showConnectionFailure = failures > 0 || unavailable;
  // Never offered for `unavailable`: submission resolves identity through the
  // same schema, so continuing would only move the failure to the end of a
  // completed assessment.
  const showContinueAnyway =
    !unavailable && failures >= CONTINUE_WITHOUT_CHECK_AFTER_FAILURES;

  if (step === 'intent') {
    return (
      <main className={styles.gate} lang={locale}>
        <div className={styles.inner}>
          <span className={styles.eyebrow}>{t('intake.returningTitle')}</span>
          <h1 className={styles.title}>{t('intake.returningBody')}</h1>

          <div
            className={styles.choices}
            role="radiogroup"
            aria-label={t('intake.returningBody')}
          >
            {RETURNING_VISIT_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                className={styles.choice}
                aria-checked={intent === option}
                onClick={() => {
                  setIntent(option);
                  setIntentError(null);
                }}
              >
                <span className={styles.choiceLabel}>{t(INTENT_LABEL_KEY[option])}</span>
                <span className={styles.choiceMark} aria-hidden="true">
                  {intent === option ? <Check size={14} strokeWidth={3} /> : null}
                </span>
              </button>
            ))}
          </div>

          {intentError ? (
            <p className={styles.error} role="alert" style={{ marginTop: 12 }}>
              {intentError}
            </p>
          ) : null}

          <button
            type="button"
            className={styles.continueButton}
            style={{ marginTop: 18 }}
            onClick={submitIntent}
          >
            {t('intake.continueLabel')}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.gate} lang={locale}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>{t('intake.eyebrow')}</span>
        {clinicName ? <p className={styles.clinicName}>{clinicName}</p> : null}

        <h1 className={styles.title}>{t('intake.title')}</h1>
        <p className={styles.body}>{t('intake.body')}</p>

        {/*
          A real <form>: Enter submits from either field on a laptop, and the
          mobile keyboard shows a "go" key, both without a keydown handler.
        */}
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submitDetails();
          }}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="intake-name">
              {t('intake.nameLabel')}
            </label>
            <input
              id="intake-name"
              className={styles.input}
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder={t('intake.namePlaceholder')}
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={80}
              aria-invalid={nameError ? 'true' : undefined}
              aria-describedby={nameError ? 'intake-name-error' : undefined}
              disabled={busy}
            />
            {nameError ? (
              <p className={styles.error} id="intake-name-error" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="intake-phone">
              {t('intake.mobileLabel')}
            </label>
            <div className={styles.phoneRow} data-invalid={phoneError ? 'true' : undefined}>
              <span className={styles.phonePrefix} aria-hidden="true">
                +91
              </span>
              <input
                id="intake-phone"
                className={styles.phoneInput}
                /*
                  `tel`, not `number`: a number input silently drops the leading
                  zero some patients type, offers a spinner nobody wants, and on
                  several Android keyboards hides the digits behind a scroll.
                  inputMode gets the numeric pad without any of that.
                */
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                placeholder={t('intake.mobilePlaceholder')}
                autoComplete="tel-national"
                enterKeyHint="go"
                /*
                  Generous: a pasted "+91 98765 43210" must survive. Everything
                  is normalised through lib/patient/phone anyway, which is the
                  same function the server writes with.
                */
                maxLength={20}
                aria-invalid={phoneError ? 'true' : undefined}
                aria-describedby={
                  phoneError ? 'intake-phone-error intake-phone-hint' : 'intake-phone-hint'
                }
                disabled={busy}
              />
            </div>
            <p className={styles.hint} id="intake-phone-hint">
              {t('intake.mobileHint')}
            </p>
            {phoneError ? (
              <p className={styles.error} id="intake-phone-error" role="alert">
                {phoneError}
              </p>
            ) : null}
          </div>

          <label className={styles.consentRow} htmlFor="intake-whatsapp-consent">
            <input
              id="intake-whatsapp-consent"
              type="checkbox"
              checked={whatsappConsent}
              onChange={(event) => setWhatsappConsent(event.target.checked)}
              disabled={busy}
            />
            <span>{t('intake.whatsappConsentLabel')}</span>
          </label>

          {showConnectionFailure ? (
            <div className={styles.failure} role="alert">
              <p className={styles.failureTitle}>
                {t(unavailable ? 'intake.unavailableTitle' : 'intake.connectionErrorTitle')}
              </p>
              <p className={styles.failureBody}>
                {t(unavailable ? 'intake.unavailableBody' : 'intake.connectionErrorBody')}
              </p>
              {showContinueAnyway ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={continueWithoutCheck}
                >
                  {t('intake.continueAnyway')}
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            className={styles.continueButton}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                {t('intake.checking')}
              </>
            ) : (
              <>
                {showConnectionFailure ? t('common.retry') : t('intake.continueLabel')}
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className={styles.privacyNote}>{t('intake.privacyNote')}</p>
      </div>
    </main>
  );
}
