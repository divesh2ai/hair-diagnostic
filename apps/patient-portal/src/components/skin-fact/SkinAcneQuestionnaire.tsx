'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, FileText, ImagePlus, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { isQuestionVisible } from '@/runtime/visibilityEngine';
import type { Question, QuestionOption } from '@/types/questionnaire';
import { useSkinAssessmentStore, type SkinAnswer, type SkinAnswers, type SkinUploadReference } from '@/stores/useSkinAssessmentStore';
import {
  loadSkinCommonProfile,
  loadSkinFactIntake,
  markConcernComplete,
  nextIncompleteConcern,
  skinConcernDraftKey,
  skinIntakeStorageKey,
  type SkinCommonProfile,
  type SkinFactIntake,
} from '@/lib/skin-fact/skinJourney';
import { SkinLogo } from './SkinBrand';
import { VoiceTextField } from './VoiceTextField';
import styles from './skin-fact.module.css';

interface AcneDraft {
  productType: 'SKIN_FACT';
  concernType: 'ACNE';
  protocolId: 'skin-acne';
  protocolVersion: '1.0.0';
  clinicSlug: string;
  skinIntakeId: string;
  currentStepIndex: number;
  uploadSessionId: string;
  answers: SkinAnswers;
}

function newSessionId() {
  return crypto.randomUUID();
}

function validDraft(value: unknown, clinicSlug: string, intakeId: string): value is AcneDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<AcneDraft>;
  return draft.productType === 'SKIN_FACT'
    && draft.concernType === 'ACNE'
    && draft.protocolId === 'skin-acne'
    && draft.protocolVersion === '1.0.0'
    && draft.clinicSlug === clinicSlug
    && draft.skinIntakeId === intakeId
    && Number.isInteger(draft.currentStepIndex)
    && typeof draft.uploadSessionId === 'string'
    && !!draft.answers && typeof draft.answers === 'object';
}

function hasAnswer(question: Question, answer: unknown) {
  if (!question.required) return true;
  if (Array.isArray(answer)) return answer.length > 0;
  return answer !== undefined && answer !== null && answer !== '';
}

function SkinUpload({ questionId, clinicSlug, value, sessionId, onChange }: {
  questionId: string;
  clinicSlug: string;
  value: unknown;
  sessionId: string;
  onChange: (value: SkinUploadReference | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const reference = value && typeof value === 'object' && (value as SkinUploadReference).kind === 'supabase_storage'
    ? value as SkinUploadReference
    : null;
  const allowPdf = questionId === 'prescription_upload';

  useEffect(() => {
    if (!reference) { setPreview(''); return; }
    if (reference.mimeType === 'application/pdf') return;
    let cancelled = false;
    fetch(`/api/upload/questionnaire?clinicSlug=${encodeURIComponent(clinicSlug)}&sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(reference.path)}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (!cancelled) setPreview(data.signedUrl); })
      .catch(() => { if (!cancelled) setError('Preview unavailable. Retry or replace the file.'); });
    return () => { cancelled = true; };
  }, [clinicSlug, reference, sessionId]);

  async function upload(file: File) {
    const allowed = allowPdf
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(allowPdf ? 'Use PDF, JPEG, PNG, or WebP.' : 'Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      setError('File must be between 1 byte and 4 MB.');
      return;
    }
    setBusy(true); setError(''); setProgress(4); setRetryFile(file);
    try {
      const signed = await fetch('/api/upload/questionnaire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicSlug, sessionId, questionId, fileName: file.name, contentType: file.type, fileSize: file.size }),
      });
      const data = await signed.json();
      if (!signed.ok) throw new Error(data.error ?? 'Could not prepare upload');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', data.signedUrl);
        xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.max(4, Math.round(event.loaded / event.total * 100)));
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'));
        xhr.onerror = () => reject(new Error('Upload failed'));
        const form = new FormData(); form.append('cacheControl', '3600'); form.append('', file); xhr.send(form);
      });
      onChange({
        kind: 'supabase_storage', bucket: 'clinical-images', path: data.path, sessionId,
        questionId, fileName: file.name, mimeType: file.type, size: file.size, uploadedAt: new Date().toISOString(),
      });
      setProgress(100); setRetryFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed');
    } finally { setBusy(false); }
  }

  async function remove() {
    if (reference) {
      await fetch('/api/upload/questionnaire', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicSlug, sessionId, path: reference.path }),
      }).catch(() => null);
    }
    onChange(null); setPreview(''); setRetryFile(null);
    if (input.current) input.current.value = '';
  }

  return <div className={styles.upload}>
    {!allowPdf && <p className={styles.muted}><ShieldCheck size={15} /> Adding clear photos is optional, but it can help the clinical team understand your concern more accurately and support the best possible outcome.</p>}
    <input ref={input} className={styles.uploadInput} type="file" accept={allowPdf ? 'application/pdf,image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp'} onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void upload(file);
    }} />
    {reference ? <>
      {reference.mimeType === 'application/pdf'
        ? <div className={styles.filePreview}><FileText size={38} /><span>{reference.fileName}</span></div>
        : preview ? <img className={styles.preview} src={preview} alt={`${questionId} preview`} /> : <LoaderCircle aria-label="Loading image preview" />}
      <div className={styles.fileRow}>
        <span><Check size={15} /> {reference.fileName}</span>
        <span className={styles.uploadActions}>
          <button className={styles.buttonGhost} type="button" onClick={() => input.current?.click()}><RotateCcw size={14} /> Replace</button>
          <button className={styles.buttonGhost} type="button" onClick={() => void remove()}><Trash2 size={14} /> Remove</button>
        </span>
      </div>
    </> : <button className={styles.uploadDrop} type="button" onClick={() => input.current?.click()} disabled={busy}>
      <span><span className={styles.uploadIcon}>{busy ? <LoaderCircle size={24} /> : <ImagePlus size={24} />}</span><strong>{busy ? 'Uploading securely…' : 'Tap to add file'}</strong><small>{allowPdf ? 'PDF, JPEG, PNG, or WebP' : 'JPEG, PNG, or WebP'} · up to 4 MB</small></span>
    </button>}
    {busy && <div className={styles.progressTrack} aria-label={`Upload ${progress}%`}><div className={styles.progressBar} style={{ width: `${progress}%` }} /></div>}
    {error && <><p className={styles.error} role="alert">{error}</p>{retryFile && <button className={styles.buttonGhost} type="button" onClick={() => void upload(retryFile)}>Retry upload</button>}</>}
  </div>;
}

function Choice({ option, selected, multi, onClick }: { option: QuestionOption; selected: boolean; multi: boolean; onClick: () => void }) {
  return <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={selected} className={`${styles.option} ${selected ? styles.optionSelected : ''}`} onClick={onClick}>
    <span className={styles.optionCheck}>{selected ? <Check size={15} /> : <Sparkles size={14} />}</span>
    <span>{option.label}</span>
  </button>;
}

export function SkinAcneQuestionnaire() {
  const clinicSlug = String(useParams().clinicSlug ?? '');
  const router = useRouter();
  const state = useSkinAssessmentStore();
  const [profile, setProfile] = useState<SkinCommonProfile | null>(null);
  const [intake, setIntake] = useState<SkinFactIntake | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const autoAdvanceTimer = useRef<number | null>(null);

  useEffect(() => {
    const common = loadSkinCommonProfile(localStorage, clinicSlug);
    if (!common?.completedAt) { router.replace(`/q/${clinicSlug}/skin/intake?next=concerns`); return; }
    const journey = loadSkinFactIntake(localStorage, clinicSlug, common.sessionId);
    if (!journey?.selectedConcerns.includes('ACNE')) { router.replace(`/q/${clinicSlug}/skin/concerns`); return; }
    let saved: unknown = null;
    try { saved = JSON.parse(localStorage.getItem(skinConcernDraftKey('ACNE', clinicSlug, journey.intakeId)) ?? 'null'); } catch {}
    const draft = validDraft(saved, clinicSlug, journey.intakeId) ? saved : null;
    const answers: SkinAnswers = draft?.answers ?? {
      age: Number(common.answers.age), sex: common.answers.gender,
      skin_type: common.answers.skinType, sensitive_skin: common.answers.sensitiveSkin,
    };
    const requestedIndex = draft?.currentStepIndex ?? 4;
    const safeIndex = requestedIndex >= 4 && requestedIndex < state.protocol.length && isQuestionVisible(state.protocol[requestedIndex], answers)
      ? requestedIndex
      : 4;
    state.initialize({ answers, currentStepIndex: safeIndex, uploadSessionId: draft?.uploadSessionId ?? newSessionId() });
    setProfile(common); setIntake(journey); setHydrated(true);
    return () => { if (autoAdvanceTimer.current !== null) window.clearTimeout(autoAdvanceTimer.current); };
  // Initialize once per journey. Store methods are stable Zustand actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicSlug, router]);

  useEffect(() => {
    if (!hydrated || !intake) return;
    const draft: AcneDraft = {
      productType: 'SKIN_FACT', concernType: 'ACNE', protocolId: 'skin-acne', protocolVersion: '1.0.0',
      clinicSlug, skinIntakeId: intake.intakeId, currentStepIndex: state.currentStepIndex,
      uploadSessionId: state.uploadSessionId, answers: state.answers,
    };
    localStorage.setItem(skinConcernDraftKey('ACNE', clinicSlug, intake.intakeId), JSON.stringify(draft));
  }, [clinicSlug, hydrated, intake, state.answers, state.currentStepIndex, state.uploadSessionId]);

  const concernProtocol = useMemo(() => state.protocol.slice(4), [state.protocol]);
  const visible = useMemo(() => concernProtocol.filter((question) => isQuestionVisible(question, state.answers)), [concernProtocol, state.answers]);
  const question = state.protocol[state.currentStepIndex];
  const position = Math.max(1, visible.findIndex((item) => item.id === question?.id) + 1);
  const percentage = Math.round(position / Math.max(visible.length, 1) * 100);
  if (!hydrated || !question || !profile || !intake) return <main className={styles.processing}><LoaderCircle aria-label="Loading Skin FACT assessment" /></main>;

  const answer = state.answers[question.id];
  const multi = question.type === 'multi_select';
  const canContinue = hasAnswer(question, answer);
  const last = position >= visible.length;

  function select(optionId: string) {
    if (!multi) {
      if (autoAdvanceTimer.current !== null) return;
      state.setAnswer(question.id, optionId);
      if (last) return;
      setAutoAdvancing(true);
      autoAdvanceTimer.current = window.setTimeout(() => {
        autoAdvanceTimer.current = null; setAutoAdvancing(false); useSkinAssessmentStore.getState().next();
      }, 180);
      return;
    }
    const current = Array.isArray(answer) ? answer : [];
    const exclusiveIds = (question.options ?? [])
      .filter((option) => ['none', 'not sure', 'none of the above'].includes(option.id.toLowerCase()))
      .map((option) => option.id);
    const next = current.includes(optionId)
      ? current.filter((item) => item !== optionId)
      : exclusiveIds.includes(optionId)
        ? [optionId]
        : [...current.filter((item) => !exclusiveIds.includes(item)), optionId];
    state.setAnswer(question.id, next);
  }

  async function submit() {
    state.setSubmitting(true);
    try {
      const current = useSkinAssessmentStore.getState();
      const applicable = current.protocol.slice(4).filter((item) => isQuestionVisible(item, current.answers));
      const concernAnswers = Object.fromEntries(applicable.flatMap((item) => current.answers[item.id] === undefined ? [] : [[item.id, current.answers[item.id]]]));
      const answers = {
        ...concernAnswers,
        age: Number(profile!.answers.age),
        sex: profile!.answers.gender,
        __meta: {
          productType: 'SKIN_FACT', concernType: 'ACNE', protocolId: 'skin-acne', protocolVersion: '1.0.0',
          commonIntakeId: profile!.sessionId, skinIntakeId: intake!.intakeId,
          skinConcernCount: intake!.selectedConcerns.length, assessmentSessionId: current.uploadSessionId,
        },
      };
      const response = await fetch('/api/assessment/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicSlug, concern: 'skin_acne', answers, patientInfo: { name: profile!.answers.name, gender: profile!.answers.gender } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Submission failed');
      localStorage.removeItem(skinConcernDraftKey('ACNE', clinicSlug, intake!.intakeId));
      const completed = markConcernComplete(intake!, 'ACNE', data.assessmentId);
      localStorage.setItem(skinIntakeStorageKey(clinicSlug, profile!.sessionId), JSON.stringify(completed));
      const upcoming = nextIncompleteConcern(completed);
      router.push(upcoming ? `/q/${clinicSlug}/skin/transition?from=ACNE&next=${upcoming}` : `/q/${clinicSlug}/skin/complete`);
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Submission failed');
      state.setSubmitting(false);
    }
  }

  const overall = intake.selectedConcerns.length > 1
    ? `Concern ${intake.currentConcernIndex + 1} of ${intake.selectedConcerns.length} · Acne`
    : 'Acne assessment';

  return <div className={`${styles.scope} ${styles.assessment}`}>
    <header className={styles.assessmentTop}>
      <div className={`${styles.container} ${styles.assessmentTopInner}`}>
        <SkinLogo href={`/skin/${clinicSlug}`} />
        <span className={styles.stepMeta}>{position} / {visible.length}</span>
      </div>
      <div className={styles.progressRail}><div className={styles.progressFill} style={{ width: `${percentage}%` }} /></div>
    </header>

    <main className={styles.questionWrap}>
      <p className={styles.questionCount}>{overall} · Question {position}</p>
      <h1>{question.title}</h1>
      <p className={styles.questionSubtitle}>{question.subtitle ?? (multi ? 'Select all that apply.' : 'Choose the answer that best fits.')}</p>
      {question.type === 'text' && <VoiceTextField multiline={false} className={styles.input} value={typeof answer === 'string' ? answer : ''} placeholder={question.validation?.placeholder} ariaLabel={question.title} onChange={(value) => state.setAnswer(question.id, value)} />}
      {question.type === 'number' && <input className={styles.input} type="number" inputMode="numeric" min={question.validation?.min} max={question.validation?.max} value={typeof answer === 'number' ? answer : ''} onChange={(event) => state.setAnswer(question.id, event.target.value ? Number(event.target.value) : '')} />}
      {question.type === 'textarea' && <VoiceTextField className={styles.textarea} value={typeof answer === 'string' ? answer : ''} ariaLabel={question.title} onChange={(value) => state.setAnswer(question.id, value)} />}
      {question.type === 'image_upload' && <SkinUpload questionId={question.id} clinicSlug={clinicSlug} sessionId={state.uploadSessionId} value={answer} onChange={(value) => state.setAnswer(question.id, value)} />}
      {['single_select', 'multi_select', 'image_select', 'scale'].includes(question.type) && <div className={`${styles.options} ${(question.options?.length ?? 0) > 4 ? styles.optionsGrid : ''}`} role={multi ? 'group' : 'radiogroup'}>
        {question.options?.map((option) => <Choice key={option.id} option={option} multi={multi} selected={Array.isArray(answer) ? answer.includes(option.id) : answer === option.id} onClick={() => select(option.id)} />)}
      </div>}
    </main>

    <footer className={styles.assessmentFooter}>
      <div className={`${styles.container} ${styles.assessmentFooterInner}`}>
        <span className={`${styles.muted} ${styles.saveNote}`}><ShieldCheck size={14} /> Your progress is saved securely</span>
        <div className={styles.footerActions}>
          <button className={styles.buttonGhost} type="button" onClick={() => position === 1 ? router.push(`/q/${clinicSlug}/skin/concerns`) : state.back()}><ArrowLeft size={15} /> Back</button>
          <button className={styles.button} type="button" disabled={!canContinue || state.isSubmitting || autoAdvancing} onClick={last ? () => void submit() : state.next}>
            {state.isSubmitting ? 'Submitting…' : last ? 'Complete assessment' : 'Continue'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </footer>
  </div>;
}