import { describe, it, expect } from "vitest";
import {
  validateNoteBody,
  normalizeInputMode,
  resolveDictationLanguage,
  dictationAvailability,
  dictationUnavailableMessage,
  DICTATION_PRIVACY_NOTICE,
  NOTE_BODY_MAX,
} from "@/lib/notes/noteModel";

// Consultation notes — validation + the Web Speech privacy/consent/fallback
// rules (requirement 4). Typing is always available; dictation degrades
// predictably; no audio is implied anywhere in the model.

describe("validateNoteBody", () => {
  it("rejects empty / whitespace", () => {
    expect(validateNoteBody("")).toBe("empty");
    expect(validateNoteBody("   ")).toBe("empty");
    expect(validateNoteBody(undefined)).toBe("empty");
  });
  it("rejects over-long bodies", () => {
    expect(validateNoteBody("x".repeat(NOTE_BODY_MAX + 1))).toBe("too_long");
  });
  it("accepts a normal note", () => {
    expect(validateNoteBody("Patient reports reduced shedding.")).toBeNull();
  });
});

describe("normalizeInputMode", () => {
  it("only DICTATION or TYPED, defaulting to TYPED", () => {
    expect(normalizeInputMode("DICTATION")).toBe("DICTATION");
    expect(normalizeInputMode("TYPED")).toBe("TYPED");
    expect(normalizeInputMode("anything")).toBe("TYPED");
    expect(normalizeInputMode(undefined)).toBe("TYPED");
  });
});

describe("resolveDictationLanguage — browser/language fallback", () => {
  it("keeps a supported tag", () => {
    expect(resolveDictationLanguage("en-IN")).toBe("en-IN");
    expect(resolveDictationLanguage("hi-IN")).toBe("hi-IN");
  });
  it("matches by base language", () => {
    expect(resolveDictationLanguage("en-GB")).toBe("en-IN"); // first en-* offered
  });
  it("falls back to the default for unsupported/empty", () => {
    expect(resolveDictationLanguage("fr-FR")).toBe("en-IN");
    expect(resolveDictationLanguage(null)).toBe("en-IN");
    expect(resolveDictationLanguage("")).toBe("en-IN");
  });
});

describe("dictationAvailability — never blocks typing", () => {
  it("available when secure + API present + mic not denied", () => {
    const a = dictationAvailability({ hasSpeechRecognition: true, isSecureContext: true, micPermission: "granted" });
    expect(a).toEqual({ available: true, reason: null, fallbackToTyping: true });
  });
  it("unavailable without Web Speech (e.g. Firefox), still allows typing", () => {
    const a = dictationAvailability({ hasSpeechRecognition: false, isSecureContext: true });
    expect(a.available).toBe(false);
    expect(a.reason).toBe("no_speech_recognition");
    expect(a.fallbackToTyping).toBe(true);
  });
  it("unavailable on an insecure origin", () => {
    const a = dictationAvailability({ hasSpeechRecognition: true, isSecureContext: false });
    expect(a.reason).toBe("insecure_context");
  });
  it("unavailable when the mic is denied", () => {
    const a = dictationAvailability({ hasSpeechRecognition: true, isSecureContext: true, micPermission: "denied" });
    expect(a.reason).toBe("mic_denied");
  });
  it("every unavailable reason has a doctor-facing message", () => {
    for (const r of ["no_speech_recognition", "insecure_context", "mic_denied"] as const) {
      expect(dictationUnavailableMessage(r).length).toBeGreaterThan(0);
    }
  });
});

describe("privacy", () => {
  const notice = DICTATION_PRIVACY_NOTICE.toLowerCase();
  it("states HairOS stores no audio", () => {
    expect(notice).toContain("no audio");
  });
  it("is honest that the browser speech service may process audio externally", () => {
    expect(notice).toContain("externally");
  });
  it("states dictation is doctor-controlled (hold to listen)", () => {
    expect(notice).toContain("hold");
  });
});
