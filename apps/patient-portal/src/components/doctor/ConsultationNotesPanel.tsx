"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { VoiceDictateButton } from "@/components/shared/VoiceDictateButton";
import {
  DICTATION_PRIVACY_NOTICE,
  NOTE_BODY_MAX,
  resolveDictationLanguage,
  validateNoteBody,
  type NoteInputMode,
} from "@/lib/notes/noteModel";

// Doctor consultation-notes panel.
//
// Reuses the existing VoiceDictateButton (Web Speech, no audio stored) for
// dictation, with the textarea always available as the typed fallback. Notes
// are dated and authored on the server; this panel renders the date-wise
// history and lets the author amend. It is intentionally self-contained — it
// owns its own fetches — so it can drop into the patient profile without
// touching the clinical review screen.

interface NoteView {
  id: string;
  authorName: string;
  body: string;
  inputMode: NoteInputMode;
  noteDate: string;
  status: "ACTIVE" | "AMENDED" | "DELETED";
}

export function ConsultationNotesPanel({
  patientId,
  assessmentId,
  language = "en-IN",
}: {
  patientId: string;
  assessmentId?: string | null;
  language?: string;
}) {
  const [notes, setNotes] = useState<NoteView[]>([]);
  const [body, setBody] = useState("");
  const [dictated, setDictated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const lastValueRef = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor/consultation-notes?patientId=${encodeURIComponent(patientId)}`);
      if (res.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error("Could not load notes.");
      setUnavailable(false);
      const data = (await res.json()) as { notes: NoteView[] };
      setNotes(data.notes.filter((n) => n.status !== "DELETED"));
    } catch {
      setNotice("Could not load previous notes. Refresh to retry.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  // VoiceDictateButton appends recognised text; if the value grew via the mic
  // (not the keyboard), mark the note as dictated for provenance.
  const onDictate = useCallback((next: string) => {
    if (next.length > lastValueRef.current.length) setDictated(true);
    lastValueRef.current = next;
    setBody(next);
  }, []);

  const onType = useCallback((v: string) => {
    lastValueRef.current = v;
    setBody(v);
  }, []);

  const save = useCallback(async () => {
    if (validateNoteBody(body)) {
      setNotice("Write a note first.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const inputMode: NoteInputMode = dictated ? "DICTATION" : "TYPED";
      const res = await fetch("/api/doctor/consultation-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          assessmentId: assessmentId ?? null,
          body: body.trim(),
          inputMode,
          language: resolveDictationLanguage(language),
        }),
      });
      if (res.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setNotice(j.error === "too_long" ? "Note is too long." : "Could not save note.");
        return;
      }
      setBody("");
      setDictated(false);
      lastValueRef.current = "";
      await load();
    } catch {
      setNotice("Could not save the note. Your text is still here; check the connection and retry.");
    } finally {
      setSaving(false);
    }
  }, [body, dictated, patientId, assessmentId, language, load]);

  if (unavailable) {
    return (
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Consultation notes</h3>
        <p className="mt-2 text-sm text-slate-500">
          Notes are not enabled yet in this environment.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Consultation notes</h3>
        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
          <Mic className="h-3.5 w-3.5" aria-hidden /> dictation or typing
        </span>
      </div>

      <div className="relative">
        <textarea
          value={body}
          onChange={(e) => onType(e.target.value)}
          rows={3}
          maxLength={NOTE_BODY_MAX}
          placeholder="Dictate or type a brief consultation note…"
          aria-label="Consultation note"
          className="w-full rounded-xl border border-stone-200 px-3 py-2 pr-11 text-base text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
        />
        <div className="absolute right-2 top-2">
          <VoiceDictateButton value={body} onChange={onDictate} lang={resolveDictationLanguage(language)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-stone-600">{DICTATION_PRIVACY_NOTICE}</span>
        <button
          type="button"
          onClick={save}
          disabled={saving || body.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white min-h-11 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save note"}
        </button>
      </div>
      {notice && <p role="alert" className="text-sm text-rose-700">{notice}</p>}

      <div className="border-t border-stone-100 pt-3">
        {loading ? (
          <p className="text-xs text-slate-600">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-slate-600">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="text-xs text-slate-700">
                <p className="max-w-prose whitespace-pre-wrap">{n.body}</p>
                <p className="mt-0.5 text-sm text-stone-600">
                  {new Date(n.noteDate).toLocaleString()} · {n.authorName} ·{" "}
                  {n.inputMode === "DICTATION" ? "dictated" : "typed"}
                  {n.status === "AMENDED" ? " · amended" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
