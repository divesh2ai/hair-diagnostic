// Lifecycle observability contract:
//   • payloads are closed-shape (typed at the call site); the emitter never
//     accepts arbitrary metadata that could be filled with patient answers,
//     tokens, or signed URLs;
//   • output is a single JSON line prefixed with "[lifecycle]" so Vercel /
//     any log tail can filter cheaply;
//   • never throws — a broken logger cannot break the request path;
//   • sanitizeErrorClass never surfaces exception messages.

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  logLifecycleEvent,
  sanitizeErrorClass,
} from "../../apps/patient-portal/src/lib/observability/lifecycle";

describe("logLifecycleEvent", () => {
  let logs: string[] = [];
  let spy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    logs = [];
    spy = jest.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it("emits a single line prefixed [lifecycle] containing a JSON payload", () => {
    logLifecycleEvent({
      event: "status.access_allowed",
      assessmentId: "asm-1",
      audience: "clinic",
      clinicId: "c1",
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[lifecycle\] /);
    const json = JSON.parse(logs[0].replace(/^\[lifecycle\] /, "")) as Record<string, unknown>;
    expect(json.event).toBe("status.access_allowed");
    expect(json.assessmentId).toBe("asm-1");
    expect(json.t).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO timestamp
  });

  it("does not throw when console.log throws", () => {
    spy.mockImplementation(() => {
      throw new Error("stdout gone");
    });
    expect(() => logLifecycleEvent({ event: "assessment.submitted" })).not.toThrow();
  });

  it("does NOT expose patient tokens, phone numbers, or free text in the payload shape", () => {
    // The payload type is closed at compile time. This test locks the
    // runtime behavior by asserting that extra properties on a cast object
    // still make it through structuredly (guarding the shape at review-time
    // is the typed part), but no field named `token`, `email`, `phone`, or
    // `answers` is emitted by the emitter itself.
    logLifecycleEvent({
      event: "consultation.approved",
      assessmentId: "asm-1",
      clinicId: "c1",
      audience: "clinic",
    });
    const json = JSON.parse(logs[0].replace(/^\[lifecycle\] /, "")) as Record<string, unknown>;
    expect(json.token).toBeUndefined();
    expect(json.email).toBeUndefined();
    expect(json.phone).toBeUndefined();
    expect(json.answers).toBeUndefined();
    expect(json.rawAnswers).toBeUndefined();
    expect(json.url).toBeUndefined();
    expect(json.signedUrl).toBeUndefined();
  });
});

describe("sanitizeErrorClass", () => {
  it("returns the constructor name for known errors", () => {
    expect(sanitizeErrorClass(new TypeError("bad"))).toBe("TypeError");
  });

  it("returns UnknownError for primitives", () => {
    expect(sanitizeErrorClass("boom")).toBe("UnknownError");
    expect(sanitizeErrorClass(42)).toBe("UnknownError");
    expect(sanitizeErrorClass(null)).toBe("UnknownError");
    expect(sanitizeErrorClass(undefined)).toBe("UnknownError");
  });

  it("never surfaces the exception message", () => {
    const err = new Error("SELECT * FROM patients WHERE phone = '+91...'");
    const result = sanitizeErrorClass(err);
    expect(result).toBe("Error");
    expect(result).not.toContain("SELECT");
    expect(result).not.toContain("+91");
  });
});
