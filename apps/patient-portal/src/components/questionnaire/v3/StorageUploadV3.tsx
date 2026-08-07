'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImageIcon, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';

import { MAX_UPLOAD_BYTES } from '@/app/api/upload/validation';
import { useAssessmentStore } from '@/stores/useAssessmentStore';

import styles from './assessment-v3.module.css';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface StoredUploadReference {
  kind: 'supabase_storage';
  bucket: 'clinical-images';
  path: string;
  sessionId: string;
  questionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

function isStoredUpload(value: unknown): value is StoredUploadReference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredUploadReference>;
  return candidate.kind === 'supabase_storage' && typeof candidate.path === 'string';
}

function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed (HTTP ${xhr.status})`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error while uploading')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);
    xhr.send(form);
  });
}

export function StorageUploadV3({
  questionId,
  clinicSlug,
  value,
  onChange,
}: {
  questionId: string;
  clinicSlug: string;
  value: unknown;
  onChange: (value: StoredUploadReference | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setAnswer = useAssessmentStore((state) => state.setAnswer);
  const answersMeta = useAssessmentStore((state) => state.answers.__meta);
  const [sessionId] = useState(() => {
    const existing =
      answersMeta && typeof answersMeta === 'object'
        ? (answersMeta as Record<string, unknown>).uploadSessionId
        : undefined;
    return typeof existing === 'string' ? existing : crypto.randomUUID();
  });
  const stored = isStoredUpload(value) ? value : null;
  const storedPath = stored?.path;
  const storedSessionId = stored?.sessionId;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const meta = answersMeta && typeof answersMeta === 'object'
      ? (answersMeta as Record<string, unknown>)
      : {};
    if (meta.uploadSessionId !== sessionId) {
      setAnswer('__meta', { ...meta, uploadSessionId: sessionId });
    }
  }, [answersMeta, sessionId, setAnswer]);

  useEffect(() => {
    if (!storedPath || !storedSessionId) return;
    let cancelled = false;
    const params = new URLSearchParams({
      clinicSlug,
      sessionId: storedSessionId,
      path: storedPath,
    });
    fetch(`/api/upload/questionnaire?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Preview unavailable');
        if (!cancelled) setPreviewUrl(data.signedUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicSlug, storedPath, storedSessionId]);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function removeStored(reference: StoredUploadReference, clearAnswer: boolean) {
    const response = await fetch('/api/upload/questionnaire', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicSlug, sessionId: reference.sessionId, path: reference.path }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Could not remove upload');
    if (clearAnswer) onChange(undefined);
  }

  async function uploadFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      setPendingFile(file);
      return;
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      setError('Image must be smaller than 4 MB.');
      setPendingFile(file);
      return;
    }

    setPendingFile(file);
    setBusy(true);
    setProgress(0);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      return localPreview;
    });
    try {
      const response = await fetch('/api/upload/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicSlug,
          sessionId,
          questionId,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not start upload');
      await uploadToSignedUrl(data.signedUrl, file, setProgress);
      const nextReference: StoredUploadReference = {
        kind: 'supabase_storage',
        bucket: 'clinical-images',
        path: data.path,
        sessionId,
        questionId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
      onChange(nextReference);
      if (stored && stored.path !== nextReference.path) {
        void removeStored(stored, false).catch(() => undefined);
      }
      setPendingFile(null);
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!stored) return;
    setError(null);
    setRemoving(true);
    try {
      await removeStored(stored, true);
      setPreviewUrl(null);
      setPendingFile(null);
      setProgress(0);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove upload');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className={styles.uploadPanel}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.srOnly}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          event.target.value = '';
        }}
      />

      {previewUrl ? (
        <div className={styles.uploadPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`Preview of ${stored?.fileName ?? pendingFile?.name ?? 'upload'}`} />
        </div>
      ) : (
        <button
          type="button"
          className={styles.uploadControl}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <span className={styles.uploadIcon} aria-hidden="true"><UploadCloud size={28} /></span>
          <strong>Tap to add photo</strong>
          <small>JPEG, PNG, or WebP · up to 4 MB</small>
        </button>
      )}

      {busy && (
        <div className={styles.uploadProgressWrap} role="status" aria-live="polite">
          <div className={styles.uploadProgressCopy}>
            <span><Loader2 size={15} className={styles.spin} /> Uploading</span>
            <strong>{progress}%</strong>
          </div>
          <div className={styles.uploadProgressTrack}>
            <span style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
          </div>
        </div>
      )}

      {!busy && stored && (
        <div className={styles.uploadSuccess} role="status">
          <span><CheckCircle2 size={16} /> {stored.fileName}</span>
          <small>{Math.max(1, Math.round(stored.size / 1024))} KB · saved securely</small>
        </div>
      )}

      {error && (
        <div className={styles.uploadError} role="alert">
          <p>{error}</p>
          {pendingFile && ALLOWED_TYPES.has(pendingFile.type) && pendingFile.size <= MAX_UPLOAD_BYTES && (
            <button type="button" onClick={() => void uploadFile(pendingFile)}>
              <RefreshCw size={14} /> Retry upload
            </button>
          )}
        </div>
      )}

      {(stored || previewUrl) && !busy && (
        <div className={styles.uploadActions}>
          <button type="button" onClick={() => inputRef.current?.click()}>
            <ImageIcon size={15} /> Replace
          </button>
          {stored && (
            <button type="button" disabled={removing} onClick={() => void handleRemove()}>
              {removing ? <Loader2 size={15} className={styles.spin} /> : <Trash2 size={15} />} Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}