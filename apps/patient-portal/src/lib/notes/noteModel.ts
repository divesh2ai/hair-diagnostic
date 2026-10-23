// Doctor consultation notes — the pure domain model.
//
// Validation, input-mode normalisation, and the Web Speech privacy/consent/
// fallback rules, all DOM-free so they can be unit-tested. The React panel
// (components/doctor/ConsultationNotesPanel) and the API route are thin shells
// over these functions.

export type NoteInputMode = "DICTATION" | "TYPED";

export const NOTE_BODY_MAX = 4000;
export const NOTE_BODY_MIN = 1;

/**
 * Languages we offer for dictation. Kept short and explicit rather than passing
 * an arbitrary BCP-47 tag straight to the Web Speech API, so an unsupported tag
 * degrades predictably instead of silently recognising the wrong language.
 */
export const SUPPORTED_DICTATION_LANGUAGES = ["en-IN", "en-US", "hi-IN"] as const;
export type DictationLanguage = (typeof SUPPORTED_DICTATION_LANGUAGES)[number];
export const DEFAULT_DICTATION_LANGUAGE: DictationLanguage = "en-IN";

export function normalizeInputMode(v: unknown): NoteInputMode {
  return v === "DICTATION" ? "DICTATION" : "TYPED";
}

/**
 * Resolve the language actually used for recognition. An exact match wins; a
 * base-language match (e.g. "en" → "en-IN") is next; otherwise the default.
 * Never returns an unsupported tag — the fallback is always a language we offer.
 */
export function resolveDictationLanguage(requested: string | null | undefined): DictationLanguage {
  if (!requested) return DEFAULT_DICTATION_LANGUAGE;
  const tag = requested.trim();
  const exact = SUPPORTED_DICTATION_LANGUAGES.find(
    (l) => l.toLowerCase() === tag.toLowerCase(),
  );
  if (exact) return exact;
  const base = tag.split("-")[0]?.toLowerCase();
  const byBase = SUPPORTED_DICTATION_LANGUAGES.find(
    (l) => l.split("-")[0].toLowerCase() === base,
  );
  return byBase ?? DEFAULT_DICTATION_LANGUAGE;
}

export interface SpeechEnvironment {
  /** window.SpeechRecognition || webkitSpeechRecognition is present. */
  hasSpeechRecognition: boolean;
  /** Secure context (https/localhost). getUserMedia/Web Speech need this. */
  isSecureContext: boolean;
  /** Last known mic permission, if the Permissions API exposed it. */
  micPermission?: "granted" | "denied" | "prompt" | "unknown";
}

export type DictationUnavailableReason =
  | "no_speech_recognition"
  | "insecure_context"
  | "mic_denied";

export interface DictationAvailability {
  /** Whether the mic button should be offered at all. */
  available: boolean;
  reason: DictationUnavailableReason | null;
  /** Always true: typing is the universal fallback, so the field never locks. */
  fallbackToTyping: true;
}

/**
 * Decide whether to offer dictation, and why not when we don't. Typing is
 * ALWAYS available — this only governs whether the mic affordance appears, so a
 * browser without Web Speech (Firefox), an insecure origin, or a denied mic
 * never blocks the doctor from writing the note.
 */
export function dictationAvailability(env: SpeechEnvironment): DictationAvailability {
  if (!env.isSecureContext) {
    return { available: false, reason: "insecure_context", fallbackToTyping: true };
  }
  if (!env.hasSpeechRecognition) {
    return { available: false, reason: "no_speech_recognition", fallbackToTyping: true };
  }
  if (env.micPermission === "denied") {
    return { available: false, reason: "mic_denied", fallbackToTyping: true };
  }
  return { available: true, reason: null, fallbackToTyping: true };
}

/**
 * The one-line consent/privacy notice shown beside the mic. Recognition runs in
 * the browser via the Web Speech API; no audio is uploaded or stored by HairOS.
 * Keeping the copy here (not buried in JSX) makes it reviewable and testable.
 */
export const DICTATION_PRIVACY_NOTICE =
  "Dictation transcribes in your browser. No audio is uploaded or stored — only the text you save.";

export function dictationUnavailableMessage(reason: DictationUnavailableReason): string {
  switch (reason) {
    case "no_speech_recognition":
      return "Voice input is not available in this browser. You can type the note instead.";
    case "insecure_context":
      return "Voice input needs a secure (https) connection. You can type the note instead.";
    case "mic_denied":
      return "Microphone access is blocked. Enable it in your browser, or type the note instead.";
  }
}

export type NoteBodyError = "empty" | "too_long";

export function validateNoteBody(body: unknown): NoteBodyError | null {
  if (typeof body !== "string") return "empty";
  const trimmed = body.trim();
  if (trimmed.length < NOTE_BODY_MIN) return "empty";
  if (trimmed.length > NOTE_BODY_MAX) return "too_long";
  return null;
}
