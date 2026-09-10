import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Access-contract guards for the post-approval routes.
//
// ── What these prove, and what they do not ──────────────────────────────────
// These read the handler SOURCE and assert that specific guards are present.
// That is a weaker claim than exercising the routes, and it is stated plainly
// rather than dressed up: they prove the guard has not been DELETED, not that
// it behaves correctly under every input.
//
// They exist because the alternative here is worse. Exercising these handlers
// needs a Supabase session, a Prisma client and three tables from an unapplied
// migration, and the repo's route-level suites that do that mocking run under
// Jest while `npm test` runs Vitest — so a route test written the other way
// either does not run in CI or reports as a failure in the wrong runner. The
// behavioural guarantees live in the unit suites beside this file
// (state machine, token, signature, lifecycle), which are pure and do run.
//
// The failure this catches is the realistic one: someone refactors a handler
// and drops an authorisation line. That is a silent, catastrophic regression,
// and a grep-level guard catches it at the cost of being a grep.

const APP = join(process.cwd(), "apps", "patient-portal", "src", "app");

function source(...segments: string[]): string {
  return readFileSync(join(APP, ...segments), "utf8");
}

/**
 * The same file with comments removed.
 *
 * Needed for the negative assertions ("this handler must not call markPaid").
 * These modules document WHY a dangerous call is absent, and naming it in that
 * explanation would fail a test for saying the right thing — so absence is
 * asserted against code, and presence against the whole file.
 */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("POST /api/consultation/[assessmentId]/share", () => {
  const src = source(
    "api",
    "consultation",
    "[assessmentId]",
    "share",
    "route.ts",
  );

  it("requires an active Doctor identity", () => {
    expect(src).toContain("requireDoctorContext()");
  });

  it("checks the assessment belongs to the caller's clinic", () => {
    expect(src).toContain("assertDoctorInClinic(doctor, context.clinicId)");
  });

  it("refuses to send anything for an unapproved consultation", () => {
    // The product principle in code: AI completion never sends clinical
    // information, and a doctor cannot send a draft either.
    expect(src).toContain('error: "not_approved"');
    expect(src).toContain('"APPROVED"');
  });

  it("gates the CART on the same resolver the cart API answers with", () => {
    // If the send gate and the cart endpoint disagreed, a doctor could send a
    // link that lands on "no confirmed plan yet".
    expect(src).toContain("resolveApprovedOrder");
  });

  it("never accepts a recipient from the request", () => {
    // The endpoint must not become a way to send arbitrary text to arbitrary
    // numbers on the strength of a doctor session.
    expect(codeOnly(src)).not.toMatch(/body\.(phone|to|recipient|number)/);
    expect(src).toContain("readSendContext");
  });

  it("never lets the request body choose the link's host", () => {
    // A body-supplied origin is a phishing primitive handed out with a login.
    expect(src).toContain("resolveOrigin(req)");
    expect(codeOnly(src)).not.toMatch(/body\.origin/);
  });
});

describe("POST /api/payments/webhook/[provider]", () => {
  const src = source("api", "payments", "webhook", "[provider]", "route.ts");

  it("verifies the signature before doing anything else", () => {
    expect(src).toContain("verifyWebhookSignature");
    const sigAt = src.indexOf("verifyWebhookSignature");
    const confirmAt = src.indexOf("confirmPayment(");
    expect(sigAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeGreaterThan(sigAt);
  });

  it("reads the raw body, not a re-serialised object", () => {
    // Re-serialising changes key order and whitespace, so every genuine
    // signature fails — which then gets "fixed" by weakening the check.
    expect(src).toContain("await req.text()");
  });

  it("answers every rejection identically", () => {
    // A caller must not be able to tell "no secret configured" from "wrong
    // signature"; the first is a configuration fact worth probing for.
    expect(src).toContain('{ error: "unauthorized" }, { status: 401 }');
  });

  it("only acts on an allowlisted capture event", () => {
    expect(src).toContain("CAPTURED_EVENTS");
    expect(src).toContain("CAPTURED_EVENTS.has(event)");
  });

  it("marks the payment as coming from the webhook, with no human actor", () => {
    expect(src).toContain('source: "PROVIDER_WEBHOOK"');
    expect(src).toContain("recordedByDoctorId: null");
  });
});

describe("POST /api/doctor/orders/[intentId]/payment", () => {
  const src = source("api", "doctor", "orders", "[intentId]", "payment", "route.ts");

  it("requires an active Doctor identity", () => {
    expect(src).toContain("requireDoctorContext()");
  });

  it("scopes the confirmation to the caller's own clinic", () => {
    expect(src).toContain("requireClinicId: doctor.clinicId");
  });

  it("records the acting doctor as the source of the claim", () => {
    expect(src).toContain('source: "CLINIC_COUNTER"');
    expect(src).toContain("recordedByDoctorId: doctor.id");
  });

  it("conceals cross-clinic misses as 404", () => {
    expect(src).toContain('{ error: "not_found" }, { status: 404 }');
  });
});

describe("POST /api/admin/fulfilment/[id]/transition", () => {
  const src = source("api", "admin", "fulfilment", "[id]", "transition", "route.ts");

  it("is Super Admin only", () => {
    expect(src).toContain("assertSuperAdmin()");
  });

  it("validates the target against the state machine's own type guard", () => {
    expect(src).toContain("isFulfilmentStatus(body.to)");
  });

  it("refuses ACKNOWLEDGED, which only the clinic may assert", () => {
    // An ops user who can close their own delivery loop is an ops user whose
    // delivery confirmations mean nothing.
    expect(src).toContain("OPS_TRANSITIONS");
    expect(src).toContain('reason: "clinic_owned_transition"');
    expect(codeOnly(src)).not.toMatch(/OPS_TRANSITIONS[\s\S]{0,200}"ACKNOWLEDGED"/);
  });

  it("audits both successful and rejected transitions", () => {
    expect(src).toContain('"KIT_FULFILMENT_STATE_CHANGED"');
    expect(src).toContain('"KIT_FULFILMENT_TRANSITION_REJECTED"');
  });
});

describe("POST /api/doctor/fulfilment/[id]/acknowledge", () => {
  const src = source("api", "doctor", "fulfilment", "[id]", "acknowledge", "route.ts");

  it("requires an active Doctor identity", () => {
    expect(src).toContain("requireDoctorContext()");
  });

  it("can only ever produce ACKNOWLEDGED", () => {
    // The endpoint takes no target from the caller — it is not a generic
    // transition route with a clinic session in front of it.
    expect(src).toContain('to: "ACKNOWLEDGED"');
    expect(codeOnly(src)).not.toMatch(/body\.to/);
  });

  it("folds the tenant check into the write itself", () => {
    expect(src).toContain("requireClinicId: doctor.clinicId");
  });
});

describe("POST /api/doctor/orders/[intentId]/treatment-start", () => {
  const src = source(
    "api",
    "doctor",
    "orders",
    "[intentId]",
    "treatment-start",
    "route.ts",
  );

  it("requires an active Doctor identity and scopes to their clinic", () => {
    expect(src).toContain("requireDoctorContext()");
    expect(src).toContain("clinicId: doctor.clinicId");
  });

  it("refuses a future start date rather than clamping it", () => {
    expect(src).toContain('{ error: "future_date" }');
  });

  it("bounds how far back a start may be placed", () => {
    expect(src).toContain("MAX_BACKDATE_DAYS");
    expect(src).toContain('{ error: "too_far_back" }');
  });
});

describe("GET /api/doctor/journey/[assessmentId]", () => {
  const src = source("api", "doctor", "journey", "[assessmentId]", "route.ts");

  it("requires an active Doctor identity in the assessment's clinic", () => {
    expect(src).toContain("requireDoctorContext()");
    expect(src).toContain("assertDoctorInClinic(doctor, target.clinicId)");
  });
});

describe("GET /api/admin/action-centre and /api/admin/fulfilment", () => {
  it("are both Super Admin only", () => {
    expect(source("api", "admin", "action-centre", "route.ts")).toContain(
      "assertSuperAdmin()",
    );
    expect(source("api", "admin", "fulfilment", "route.ts")).toContain(
      "assertSuperAdmin()",
    );
  });

  it("never widens a bad status filter into 'every row'", () => {
    const src = source("api", "admin", "fulfilment", "route.ts");
    expect(src).toContain("if (parsed.length > 0) statuses = parsed;");
  });
});

describe("GET /api/cart/[assessmentId] — the existing contract still holds", () => {
  const src = source("api", "cart", "[assessmentId]", "route.ts");

  it("still requires a bound token or a clinic-scoped doctor session", () => {
    expect(src).toContain("verifyCartToken(token, assessmentId)");
    expect(src).toContain("assertDoctorInClinic(doctor, target.clinicId)");
  });

  it("still conceals every rejection as the same 404", () => {
    expect(src).toContain("NOT_FOUND_BODY");
  });

  it("records a view only for the patient, never for a doctor preview", () => {
    // A doctor's own verification click must not be reported back to them as
    // proof the patient has seen the plan.
    expect(src).toContain('if (caller.kind === "patient")');
    expect(src).toContain('subject: "CART"');
  });
});

describe("POST /api/cart/[assessmentId]/checkout", () => {
  const src = source("api", "cart", "[assessmentId]", "checkout", "route.ts");

  it("accepts a bound cart token and nothing else", () => {
    // No doctor-session fallback: a doctor previewing a cart is not starting
    // the patient's payment clock.
    expect(src).toContain("verifyCartToken(token, assessmentId)");
    expect(codeOnly(src)).not.toContain("requireDoctorContext");
  });

  it("can only ever write PENDING", () => {
    // The property that makes a patient-callable checkout endpoint safe.
    const code = codeOnly(src);
    expect(code).toContain("startCheckout");
    expect(code).not.toContain("markPaid");
    expect(code).not.toContain("confirmPayment");
    expect(code).not.toContain('"PAID"');
  });

  it("never takes an amount from the caller", () => {
    expect(src).toContain("amountMinor: null");
  });

  it("conceals every rejection as the same 404", () => {
    expect(src).toContain("NOT_FOUND_BODY");
  });
});

describe("the patient report page", () => {
  const src = readFileSync(
    join(APP, "patient", "report", "[token]", "page.tsx"),
    "utf8",
  );

  it("takes the assessment id from the verified token and nowhere else", () => {
    expect(src).toContain("verdict.assessmentId");
    expect(codeOnly(src)).not.toMatch(/searchParams/);
  });

  it("composes the report as a patient-equivalent audience", () => {
    // Which is what subjects it to the approval gate in loadReport — the
    // token's revocation lever.
    expect(src).toContain('kind: "patient_share_token"');
  });

  it("refuses indexing, because the URL contains a live credential", () => {
    expect(src).toContain("robots");
    expect(src).toContain("index: false");
  });

  it("answers every non-expiry failure with one generic notice", () => {
    expect(src).toContain('verdict.error === "EXPIRED"');
    expect(src).toContain('{ kind: "invalid" }');
  });
});

describe("the report loader's approval gate", () => {
  const src = readFileSync(
    join(
      process.cwd(),
      "apps",
      "patient-portal",
      "src",
      "lib",
      "reports",
      "one-page",
      "loadReport.ts",
    ),
    "utf8",
  );

  it("holds patient share tokens to the same approval rule as conference tokens", () => {
    expect(src).toContain('auth.kind === "patient_share_token"');
    expect(src).toContain('throw new ReportAccessError(403, "Consultation is not approved")');
  });

  it("still refuses cross-clinic access for clinic sessions", () => {
    expect(src).toContain('throw new ReportAccessError(403, "Cross-clinic access denied")');
  });
});

describe("the WhatsApp transport", () => {
  const src = readFileSync(
    join(
      process.cwd(),
      "apps",
      "patient-portal",
      "src",
      "lib",
      "delivery",
      "whatsappProvider.ts",
    ),
    "utf8",
  );

  it("defaults to a transport that contacts nobody", () => {
    expect(src).toContain('process.env.WHATSAPP_PROVIDER ?? "dev"');
  });

  it("requires two independent switches before a real message is sent", () => {
    // "We accidentally messaged a real patient during testing" is not a
    // recoverable mistake — the message is on their phone.
    expect(src).toContain('process.env.WHATSAPP_LIVE_SEND === "1"');
    expect(src).toContain('process.env.NODE_ENV === "production"');
  });

  it("never logs a full phone number or a message body", () => {
    expect(src).toContain("message.to.slice(-4)");
    expect(codeOnly(src)).not.toMatch(
      /console\.(log|info|warn|error)\([^)]*message\.body/,
    );
  });
});
