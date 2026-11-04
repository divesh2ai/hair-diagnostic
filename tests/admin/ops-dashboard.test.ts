import { describe, it, expect } from "vitest";
import {
  classifyClinic,
  classifyReportReadiness,
  toGatedKpi,
  type ClassifyInput,
  type ReportAssetFacts,
} from "@/lib/admin/opsDashboard/classify";
import { resolveWindow, resolveRange, parseRange } from "@/lib/admin/opsDashboard/window";
import { resolveDoctorSignIn } from "@/lib/admin/opsDashboard/identity";
import {
  STATUS_LABEL,
  STATUS_TONE,
  FILTER_OPTIONS,
  REPORT_READINESS_LABEL,
  formatInrFromMinor,
  relativeTime,
} from "@/lib/admin/opsDashboard/format";

// A healthy, actively-using clinic as the baseline; each test overrides the
// one fact under examination. dossiersReady matches approvalsAllTime so the
// baseline has no asset gap, and the two new pipeline counters are zero.
const NOW = new Date("2026-02-01T12:00:00.000Z");
function base(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    status: "ACTIVE",
    doctorCount: 2,
    signedInCount: 1,
    authReadable: true,
    assessmentsAllTime: 10,
    approvalsAllTime: 5,
    reviewedCasesAllTime: 5,
    awaitingReview: 0,
    assessmentsWithoutConsultation: 0,
    reconciliationDiscrepancies: 0,
    deliveryConnected: true,
    reportsFailed: 0,
    reportsSent: 5,
    dossiersReady: 5,
    lastActivityAt: new Date("2026-01-28T00:00:00.000Z"), // 4 days before NOW
    lastDoctorActivityAt: new Date("2026-01-28T00:00:00.000Z"), // recent doctor work
    now: NOW,
    ...overrides,
  };
}

describe("classifyClinic — adoption is not activation", () => {
  it("an ACTIVE clinic that nobody has used is NOT actively using", () => {
    const { flags, primaryStatus } = classifyClinic(
      base({
        assessmentsAllTime: 0,
        approvalsAllTime: 0,
        reviewedCasesAllTime: 0,
        signedInCount: 0,
        reportsSent: 0,
        dossiersReady: 0,
        lastDoctorActivityAt: null,
      }),
    );
    expect(flags.activelyUsing).toBe(false);
    expect(primaryStatus).not.toBe("ACTIVELY_USING");
  });

  it("a fully-adopted clinic is activelyUsing", () => {
    const { flags, primaryStatus } = classifyClinic(base());
    expect(flags.activelyUsing).toBe(true);
    expect(primaryStatus).toBe("ACTIVELY_USING");
  });
});

describe("classifyClinic — COMPLETED is not APPROVED", () => {
  it("assessments completed but zero approvals ⇒ not actively using, and pending if awaiting", () => {
    const { flags, primaryStatus } = classifyClinic(
      base({
        assessmentsAllTime: 20,
        approvalsAllTime: 0,
        reviewedCasesAllTime: 0,
        awaitingReview: 7,
        dossiersReady: 0,
        reportsSent: 0,
      }),
    );
    expect(flags.activelyUsing).toBe(false);
    expect(flags.pendingReview).toBe(true);
    expect(primaryStatus).toBe("PENDING_REVIEW");
  });
});

describe("classifyClinic — missing consultation is a pipeline gap, not doctor inaction", () => {
  it("COMPLETED assessments with no consultation flag missingConsultation, never pendingReview", () => {
    // 11 completed-without-consultation and NOTHING awaiting a doctor: the
    // clinic must not be chipped as a doctor-review problem.
    const { flags, primaryStatus } = classifyClinic(
      base({ awaitingReview: 0, assessmentsWithoutConsultation: 11 }),
    );
    expect(flags.missingConsultation).toBe(true);
    expect(flags.pendingReview).toBe(false);
    expect(primaryStatus).toBe("MISSING_CONSULTATION");
  });

  it("missing consultation and awaiting review are independent flags", () => {
    const { flags } = classifyClinic(
      base({ awaitingReview: 3, assessmentsWithoutConsultation: 11 }),
    );
    expect(flags.pendingReview).toBe(true);
    expect(flags.missingConsultation).toBe(true);
    // Pipeline gap outranks the routine doctor queue for the chip, so the gap
    // is never hidden behind "pending review".
  });
});

describe("classifyClinic — reconciliation discrepancy is surfaced, never hidden", () => {
  it("an approved-version / reviewDecision conflict flags and chips the discrepancy", () => {
    const { flags, primaryStatus } = classifyClinic(base({ reconciliationDiscrepancies: 1 }));
    expect(flags.reconciliationDiscrepancy).toBe(true);
    expect(primaryStatus).toBe("RECONCILIATION_DISCREPANCY");
  });

  it("a discrepancy outranks an otherwise-healthy 'actively using' badge", () => {
    const { primaryStatus } = classifyClinic(base({ reconciliationDiscrepancies: 1, awaitingReview: 2 }));
    expect(primaryStatus).toBe("RECONCILIATION_DISCREPANCY");
  });
});

describe("classifyClinic — never logged in", () => {
  it("no doctors ⇒ never logged in (regardless of auth readability)", () => {
    const { flags, primaryStatus } = classifyClinic(base({ doctorCount: 0, signedInCount: 0, authReadable: false }));
    expect(flags.neverLoggedIn).toBe(true);
    expect(primaryStatus).toBe("NEVER_LOGGED_IN");
  });

  it("doctors exist but none signed in, auth readable ⇒ never logged in", () => {
    const { flags } = classifyClinic(base({ signedInCount: 0 }));
    expect(flags.neverLoggedIn).toBe(true);
  });

  it("doctors exist, auth NOT readable ⇒ not asserted as never logged in (unknown)", () => {
    const { flags } = classifyClinic(base({ signedInCount: 0, authReadable: false }));
    expect(flags.neverLoggedIn).toBe(false);
  });
});

describe("classifyClinic — report attention is measured, never inferred from approval", () => {
  it("approved versions with a dossier shortfall ⇒ attention (asset gap), even with delivery not connected", () => {
    // 5 approved, only 3 dossiers READY → 2 approved reports have no asset.
    // This is a DB-measured gap, not a guess from the approval count.
    const { flags } = classifyClinic(base({ approvalsAllTime: 5, dossiersReady: 3, deliveryConnected: false, reportsSent: 0 }));
    expect(flags.reportDeliveryAttention).toBe(true);
  });

  it("approvals fully matched by ready dossiers, nothing failed ⇒ no attention", () => {
    const { flags } = classifyClinic(base({ approvalsAllTime: 5, dossiersReady: 5, reportsSent: 5, reportsFailed: 0 }));
    expect(flags.reportDeliveryAttention).toBe(false);
  });

  it("failed sends with delivery connected ⇒ attention", () => {
    const { flags } = classifyClinic(base({ reportsFailed: 2 }));
    expect(flags.reportDeliveryAttention).toBe(true);
  });

  it("the same failures with delivery NOT connected and assets complete ⇒ no attention asserted", () => {
    const { flags } = classifyClinic(base({ reportsFailed: 2, deliveryConnected: false }));
    expect(flags.reportDeliveryAttention).toBe(false);
  });

  it("ready dossiers but none sent (connected) ⇒ delivery attention", () => {
    const { flags } = classifyClinic(base({ approvalsAllTime: 3, dossiersReady: 3, reportsSent: 0 }));
    expect(flags.reportDeliveryAttention).toBe(true);
  });
});

describe("classifyClinic — recency and lifecycle priority", () => {
  it("doctor activity older than 30 days ⇒ not actively using (stopped)", () => {
    const old = new Date("2025-12-01T00:00:00.000Z");
    const { flags, primaryStatus } = classifyClinic(
      base({ lastActivityAt: old, lastDoctorActivityAt: old }),
    );
    expect(flags.activelyUsing).toBe(false);
    expect(flags.noRecentActivity).toBe(true);
    expect(primaryStatus).toBe("NO_RECENT_ACTIVITY");
  });

  it("archived clinics carry no operational flags and chip ARCHIVED", () => {
    const { flags, primaryStatus } = classifyClinic(
      base({ status: "ARCHIVED", awaitingReview: 3, assessmentsWithoutConsultation: 2, reconciliationDiscrepancies: 1 }),
    );
    expect(primaryStatus).toBe("ARCHIVED");
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it("suspended clinics chip SUSPENDED ahead of operational facets", () => {
    const { primaryStatus } = classifyClinic(base({ status: "SUSPENDED", awaitingReview: 3, reconciliationDiscrepancies: 1 }));
    expect(primaryStatus).toBe("SUSPENDED");
  });

  it("pending review outranks delivery attention in the primary chip", () => {
    const { primaryStatus } = classifyClinic(base({ awaitingReview: 2, reportsFailed: 2 }));
    expect(primaryStatus).toBe("PENDING_REVIEW");
  });

  it("missing consultation outranks pending review in the primary chip", () => {
    const { primaryStatus } = classifyClinic(base({ awaitingReview: 2, assessmentsWithoutConsultation: 5 }));
    expect(primaryStatus).toBe("MISSING_CONSULTATION");
  });
});

describe("classifyClinic — genuine reviews are not only approvals", () => {
  it("rejections and revision requests are clinical work: reviewed>0 + recent ⇒ actively using even with zero approvals", () => {
    // A doctor who has only REJECTED or asked for REVISION has done genuine
    // clinical work; an approval-only count would miss this. dossiersReady=0 is
    // consistent (no approvals) and must NOT raise a report-attention flag,
    // because assetGap requires approvals>0.
    const { flags, primaryStatus } = classifyClinic(
      base({ approvalsAllTime: 0, reviewedCasesAllTime: 4, dossiersReady: 0, reportsSent: 0 }),
    );
    expect(flags.activelyUsing).toBe(true);
    expect(flags.reportDeliveryAttention).toBe(false);
    expect(primaryStatus).toBe("ACTIVELY_USING");
  });
});

describe("classifyClinic — adoption follows clinical activity, not the sign-in clock", () => {
  it("an old sign-in but recent clinical activity still counts as using HairOS", () => {
    // classify takes no last-sign-in input at all: recency is the DOCTOR
    // activity clock. A doctor whose recorded sign-in is ancient but who
    // reviewed a case yesterday is actively using.
    const { flags, primaryStatus } = classifyClinic(
      base({ signedInCount: 1, lastActivityAt: new Date("2024-01-01T00:00:00.000Z") }),
    );
    expect(flags.activelyUsing).toBe(true);
    expect(primaryStatus).toBe("ACTIVELY_USING");
  });

  it("recent PATIENT submissions do not prove adoption when the doctor has gone quiet", () => {
    // Patients keep submitting (lastActivityAt recent) but the doctor's last
    // clinical action is months old → not actively using; stopped.
    const { flags, primaryStatus } = classifyClinic(
      base({
        lastActivityAt: NOW,
        lastDoctorActivityAt: new Date("2025-11-01T00:00:00.000Z"),
      }),
    );
    expect(flags.activelyUsing).toBe(false);
    expect(flags.noRecentActivity).toBe(true);
    expect(primaryStatus).toBe("NO_RECENT_ACTIVITY");
  });
});

describe("classifyClinic — logged in but no clinical work yet", () => {
  it("a signed-in doctor with assessments but no reviewed case ⇒ logged in, work not started", () => {
    const { flags, primaryStatus } = classifyClinic(
      base({
        signedInCount: 1,
        assessmentsAllTime: 3,
        approvalsAllTime: 0,
        reviewedCasesAllTime: 0,
        awaitingReview: 0,
        dossiersReady: 0,
        reportsSent: 0,
        lastDoctorActivityAt: null,
      }),
    );
    expect(flags.loggedInNoActivity).toBe(true);
    expect(flags.activelyUsing).toBe(false);
    expect(primaryStatus).toBe("LOGGED_IN_NO_ACTIVITY");
  });
});

describe("classifyClinic — unknown is not the same as a confident zero", () => {
  it("auth unreadable, no clinical signal, staffed clinic ⇒ UNKNOWN_TRACKING, never 'never logged in'", () => {
    const { flags, primaryStatus } = classifyClinic(
      base({
        authReadable: false,
        signedInCount: 0,
        assessmentsAllTime: 5,
        approvalsAllTime: 0,
        reviewedCasesAllTime: 0,
        awaitingReview: 0,
        dossiersReady: 0,
        reportsSent: 0,
        lastDoctorActivityAt: null,
      }),
    );
    expect(flags.neverLoggedIn).toBe(false);
    expect(flags.trackingUnavailable).toBe(true);
    expect(primaryStatus).toBe("UNKNOWN_TRACKING");
  });

  it("once a clinical signal exists, adoption is knowable even if auth is unreadable", () => {
    // reviewedCases>0 is itself proof of authenticated clinical work, so an
    // unreadable auth table does not make adoption Unknown.
    const { flags, primaryStatus } = classifyClinic(
      base({ authReadable: false, signedInCount: 0, reviewedCasesAllTime: 3 }),
    );
    expect(flags.trackingUnavailable).toBe(false);
    expect(primaryStatus).toBe("ACTIVELY_USING");
  });
});

describe("resolveDoctorSignIn — login across supported identity mappings", () => {
  const EMAIL = "auth-email-uid";
  const PHONE = "auth-phone-uid";
  const t = (iso: string) => new Date(iso);

  it("resolves a sign-in recorded against the PHONE identity, not just the canonical one", () => {
    const map = new Map<string, Date | null>([[PHONE, t("2026-01-10T00:00:00Z")]]);
    const r = resolveDoctorSignIn({ emailUserId: EMAIL, phoneUserId: PHONE }, map);
    expect(r.hasAccount).toBe(true);
    expect(r.lastSignInAt?.toISOString()).toBe("2026-01-10T00:00:00.000Z");
  });

  it("takes the LATEST across both identities", () => {
    const map = new Map<string, Date | null>([
      [EMAIL, t("2026-01-05T00:00:00Z")],
      [PHONE, t("2026-02-01T00:00:00Z")],
    ]);
    const r = resolveDoctorSignIn({ emailUserId: EMAIL, phoneUserId: PHONE }, map);
    expect(r.lastSignInAt?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("an account that exists but was never used ⇒ hasAccount true, lastSignInAt null (not 'never' vs no account)", () => {
    const map = new Map<string, Date | null>([[EMAIL, null]]);
    const r = resolveDoctorSignIn({ emailUserId: EMAIL, phoneUserId: null }, map);
    expect(r.hasAccount).toBe(true);
    expect(r.lastSignInAt).toBeNull();
  });

  it("no linked identity at all ⇒ hasAccount false", () => {
    const r = resolveDoctorSignIn({ emailUserId: null, phoneUserId: null }, new Map());
    expect(r.hasAccount).toBe(false);
    expect(r.lastSignInAt).toBeNull();
  });
});

describe("resolveRange — Today / Last 7 days / Last 30 days / All time presets", () => {
  it("every preset parses and produces a forward window", () => {
    for (const r of ["today", "7d", "30d", "all"] as const) {
      const w = resolveRange(r);
      expect(new Date(w.fromIso).getTime()).toBeLessThan(new Date(w.toIso).getTime());
    }
  });

  it("labels are human and distinct", () => {
    expect(resolveRange("today").label).toBe("Today");
    expect(resolveRange("7d").label).toBe("Last 7 days");
    expect(resolveRange("30d").label).toBe("Last 30 days");
    expect(resolveRange("all").label).toBe("All time");
  });

  it("'all time' starts no later than the year 2000 so it covers every real row", () => {
    const w = resolveRange("all");
    expect(new Date(w.fromIso).getTime()).toBeLessThanOrEqual(new Date("2000-01-02T00:00:00Z").getTime());
  });

  it("'7d' spans seven IST days and shares the same exclusive end as 'today'", () => {
    const seven = resolveRange("7d");
    const today = resolveRange("today");
    expect(seven.toIso).toBe(today.toIso);
    const days = (new Date(seven.toIso).getTime() - new Date(seven.fromIso).getTime()) / 86_400_000;
    expect(days).toBe(7);
  });

  it("parseRange only accepts known presets", () => {
    expect(parseRange("7d")).toBe("7d");
    expect(parseRange("all")).toBe("all");
    expect(parseRange("nonsense")).toBeNull();
    expect(parseRange(null)).toBeNull();
  });
});

// ── Report readiness: the five-way separation the task demands ──────────────
function facts(overrides: Partial<ReportAssetFacts> = {}): ReportAssetFacts {
  return {
    approved: true,
    onePagerSnapshot: "PRESENT",
    dossierReady: true,
    retrieval: "VERIFIED",
    ...overrides,
  };
}

describe("classifyReportReadiness — availability is not inferred from approval", () => {
  it("approved + snapshot present + dossier ready + retrieval verified ⇒ AVAILABLE", () => {
    expect(classifyReportReadiness(facts())).toBe("AVAILABLE");
  });

  it("not approved ⇒ NOT_APPROVED regardless of any stray asset", () => {
    expect(classifyReportReadiness(facts({ approved: false }))).toBe("NOT_APPROVED");
  });

  it("approved but snapshot confirmed ABSENT ⇒ ASSET_MISSING (the Radiance case)", () => {
    expect(classifyReportReadiness(facts({ onePagerSnapshot: "ABSENT" }))).toBe("ASSET_MISSING");
  });

  it("approved but dossier not ready ⇒ ASSET_MISSING", () => {
    expect(classifyReportReadiness(facts({ dossierReady: false }))).toBe("ASSET_MISSING");
  });

  it("approved, asset present, but a tested retrieval FAILED ⇒ RETRIEVAL_FAILED", () => {
    expect(classifyReportReadiness(facts({ retrieval: "FAILED" }))).toBe("RETRIEVAL_FAILED");
  });

  it("approved but storage unreadable (snapshot UNKNOWN) ⇒ UNVERIFIABLE, never AVAILABLE", () => {
    expect(
      classifyReportReadiness(facts({ onePagerSnapshot: "UNKNOWN", retrieval: "NOT_TESTED" })),
    ).toBe("UNVERIFIABLE");
  });

  it("a dossier that is ready does NOT make a missing snapshot look available", () => {
    expect(classifyReportReadiness(facts({ onePagerSnapshot: "ABSENT", dossierReady: true }))).toBe("ASSET_MISSING");
  });
});

describe("report readiness — reconciles with the production snapshot evidence", () => {
  it("13 approved versions, 12 matching snapshots, 1 absent ⇒ 12 AVAILABLE + 1 ASSET_MISSING", () => {
    // Model the Radiance evidence: one approved consultation has no matching
    // one-pager snapshot; the other twelve are fully available.
    const rows: ReportAssetFacts[] = [
      ...Array.from({ length: 12 }, () => facts()),
      facts({ onePagerSnapshot: "ABSENT" }),
    ];
    const verdicts = rows.map(classifyReportReadiness);
    expect(verdicts.filter((v) => v === "AVAILABLE").length).toBe(12);
    expect(verdicts.filter((v) => v === "ASSET_MISSING").length).toBe(1);
    // Approval count (13) is deliberately NOT the availability count (12).
    expect(rows.filter((r) => r.approved).length).toBe(13);
  });
});

describe("toGatedKpi — a kit intent is never a paid order; absent data is never zero", () => {
  it("NOT_CONNECTED yields null figures, not 0", () => {
    const k = toGatedKpi("NOT_CONNECTED", 0, 0);
    expect(k.state).toBe("NOT_CONNECTED");
    expect(k.today).toBeNull();
    expect(k.allTime).toBeNull();
  });

  it("CONNECTED carries the real figures", () => {
    const k = toGatedKpi("CONNECTED", 1, 9);
    expect(k).toEqual({ state: "CONNECTED", today: 1, allTime: 9 });
  });
});

describe("resolveWindow — Asia/Kolkata day boundaries", () => {
  it("defaults to today", () => {
    const w = resolveWindow(null, null);
    expect(w.label).toBe("Today");
    expect(new Date(w.fromIso).getTime()).toBeLessThan(new Date(w.toIso).getTime());
  });

  it("an explicit single day maps to IST midnight → next IST midnight", () => {
    const w = resolveWindow("2026-01-01", "2026-01-01");
    expect(w.fromIso).toBe("2025-12-31T18:30:00.000Z");
    expect(w.toIso).toBe("2026-01-01T18:30:00.000Z");
  });

  it("a reversed range is swapped, not errored", () => {
    const forward = resolveWindow("2026-01-01", "2026-01-03");
    const reversed = resolveWindow("2026-01-03", "2026-01-01");
    expect(reversed.fromIso).toBe(forward.fromIso);
    expect(reversed.toIso).toBe(forward.toIso);
    expect(forward.label).toContain("–");
  });
});

describe("format helpers", () => {
  it("every primary status has a human label and tone", () => {
    for (const key of Object.keys(STATUS_LABEL)) {
      expect(STATUS_LABEL[key as keyof typeof STATUS_LABEL]).toBeTruthy();
    }
  });

  it("every primary status also has a badge tone", () => {
    for (const key of Object.keys(STATUS_LABEL)) {
      expect(STATUS_TONE[key as keyof typeof STATUS_TONE]).toBeTruthy();
    }
  });

  it("the honest usage statuses the task names are all labelled", () => {
    expect(STATUS_LABEL.LOGGED_IN_NO_ACTIVITY).toBeTruthy();
    expect(STATUS_LABEL.NO_RECENT_ACTIVITY).toBeTruthy();
    expect(STATUS_LABEL.UNKNOWN_TRACKING.toLowerCase()).toContain("unknown");
    expect(STATUS_LABEL.ONBOARDING_IDLE.toLowerCase()).toContain("onboarding");
  });

  it("the queue and usage filters the task names are offered", () => {
    const values = FILTER_OPTIONS.map((o) => o.value);
    expect(values).toContain("pendingReview");
    expect(values).toContain("missingConsultation");
    expect(values).toContain("reconciliationDiscrepancy");
    expect(values).toContain("onboardingPending");
    expect(values).toContain("loggedInNoActivity");
    expect(values).toContain("noRecentActivity");
  });

  it("missing consultation is labelled as pipeline attention, not doctor inaction", () => {
    const opt = FILTER_OPTIONS.find((o) => o.value === "missingConsultation");
    expect(opt?.label.toLowerCase()).toContain("pipeline");
  });

  it("every report readiness verdict has a label", () => {
    for (const key of ["NOT_APPROVED", "AVAILABLE", "RETRIEVAL_FAILED", "ASSET_MISSING", "UNVERIFIABLE"]) {
      expect(REPORT_READINESS_LABEL[key]).toBeTruthy();
    }
  });

  it("paise format to whole rupees", () => {
    expect(formatInrFromMinor(334700)).toBe("₹3,347");
  });

  it("relativeTime handles null", () => {
    expect(relativeTime(null)).toBe("—");
  });
});
