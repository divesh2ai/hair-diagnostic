import { describe, expect, it } from 'vitest';
import { decisionGate } from '../../apps/patient-portal/src/lib/doctor/decisionGate';

// The single most dangerous interaction on the review screen.
//
// Approval posts an expected content version and the server cuts the kit order
// from the SAVED consultation. A doctor holding staged, unsaved kit edits who
// pressed Approve would therefore have approved the PREVIOUS lineup — silently,
// with a success toast, and an order created from a protocol they had just
// changed. These tests exist so that behaviour cannot come back.

describe('decisionGate — dirty lineup blocks approval', () => {
  it('blocks approval while the lineup has unsaved edits', () => {
    const gate = decisionGate({ state: 'idle', lineupDirty: true });
    expect(gate.canApprove).toBe(false);
  });

  it('always explains the refusal', () => {
    // A disabled button with no reason is indistinguishable from a bug, and a
    // doctor will click it repeatedly before looking for the editor.
    const gate = decisionGate({ state: 'idle', lineupDirty: true });
    expect(gate.blockedReason).toMatch(/save the lineup before approving/i);
  });

  it('allows approval once the lineup is saved', () => {
    const gate = decisionGate({ state: 'idle', lineupDirty: false });
    expect(gate).toEqual({ canApprove: true, blockedReason: null });
  });

  it('still blocks a dirty lineup after a failed save', () => {
    // The retry path must not become a hole in the rule.
    const gate = decisionGate({ state: 'error', lineupDirty: true });
    expect(gate.canApprove).toBe(false);
  });
});

describe('decisionGate — duplicate submission', () => {
  it('blocks a second press while the decision is in flight', () => {
    expect(decisionGate({ state: 'saving', lineupDirty: false }).canApprove).toBe(
      false,
    );
  });

  it('does not nag while saving', () => {
    // The spinner is the explanation; a warning here would read as an error.
    expect(
      decisionGate({ state: 'saving', lineupDirty: false }).blockedReason,
    ).toBeNull();
  });
});

describe('decisionGate — retry and terminal states', () => {
  it('permits retry after a failed save with a clean lineup', () => {
    // A failed save is precisely the state a retry must be possible from.
    expect(decisionGate({ state: 'error', lineupDirty: false }).canApprove).toBe(
      true,
    );
  });

  it('blocks re-approval of an approved consultation', () => {
    expect(
      decisionGate({ state: 'approved', lineupDirty: false }).canApprove,
    ).toBe(false);
  });

  it('does not warn about a stale dirty flag on an approved case', () => {
    // The editor unmounts on approval. A dirty flag left behind must not
    // resurrect "unsaved changes" on a case that is already decided.
    const gate = decisionGate({ state: 'approved', lineupDirty: true });
    expect(gate.canApprove).toBe(false);
    expect(gate.blockedReason).toBeNull();
  });
});

describe('decisionGate — the full doctor sequence', () => {
  it('modify → blocked, save → approve → in flight', () => {
    // Modify the lineup but do not save: approval is refused, so no POST to
    // /order can be issued from this state.
    expect(decisionGate({ state: 'idle', lineupDirty: true }).canApprove).toBe(
      false,
    );
    // Save the lineup: the flag clears and approval becomes available.
    expect(decisionGate({ state: 'idle', lineupDirty: false }).canApprove).toBe(
      true,
    );
    // Approve: further presses are refused while the request is in flight.
    expect(decisionGate({ state: 'saving', lineupDirty: false }).canApprove).toBe(
      false,
    );
  });
});
