import { describe, expect, it } from "vitest";
import { resolveWhatsappSendUiState } from "../../apps/patient-portal/src/app/doctor/reports/[assessmentId]/sections/DecisionBar";

// The dev transport (`providerStatus: "dev_accepted"`) must never render the
// same UI state as a real Meta send — a doctor who sees "WhatsApp Sent ✓" on
// staging, with no real message on any phone, is the exact false-success this
// gate exists to eliminate. This pins the one function that decides the state
// from a `/share` response, including the case that was previously wrong: a
// DUPLICATE dev-transport send (`alreadySent: true`) used to read as
// "already_sent" regardless of `live`, which looked identical to a genuine
// repeat of a real delivery.

describe("resolveWhatsappSendUiState — dev_accepted must never look like a real send", () => {
  it("a fresh live send is 'sent'", () => {
    expect(resolveWhatsappSendUiState({ live: true, alreadySent: false })).toBe("sent");
  });

  it("a duplicate live send is 'already_sent'", () => {
    expect(resolveWhatsappSendUiState({ live: true, alreadySent: true })).toBe("already_sent");
  });

  it("a fresh dev-transport send is 'test_transport', never 'sent'", () => {
    const state = resolveWhatsappSendUiState({ live: false, alreadySent: false });
    expect(state).toBe("test_transport");
    expect(state).not.toBe("sent");
  });

  it("REGRESSION: a duplicate dev-transport send is STILL 'test_transport', never 'already_sent' — live gates before alreadySent", () => {
    const state = resolveWhatsappSendUiState({ live: false, alreadySent: true });
    expect(state).toBe("test_transport");
    expect(state).not.toBe("already_sent");
    expect(state).not.toBe("sent");
  });

  it("'sent' and 'already_sent' are reachable only when live is true", () => {
    const combos = [
      { live: false, alreadySent: false },
      { live: false, alreadySent: true },
    ];
    for (const combo of combos) {
      const state = resolveWhatsappSendUiState(combo);
      expect(["sent", "already_sent"]).not.toContain(state);
    }
  });
});
