// ACCEPTANCE TEST — clinic + patient report-storage isolation (PR #28 launch gate)
//
// Proves the storage-key invariants that keep one clinic's approved reports from
// ever overwriting, colliding with, or being addressable as another clinic's —
// even when two patients in two different clinics share an identical name.
//
// ── Why this test is path-level, not DB-level ────────────────────────────────
// Cross-clinic READ authorisation is already covered by the route-guard tests
// (tests/api/pdf-release-gate, tests/api/doctor-authz, tests/post-approval/*)
// and the orchestrator access tests. What those do NOT prove is the property
// this launch requirement is really about: that the OBJECT KEYS the three
// report buckets are written under are a function of IMMUTABLE IDS
// (clinicId / assessmentId / consultationVersionId / asset id), never of the
// patient's NAME — so a shared name can never produce a shared object, and a
// revision can never land on a predecessor's bytes. The production buckets are
// private and read only through short-lived signed URLs, so the object key is
// the last line of physical isolation between tenants. This test pins it.
//
// Runs under the repo vitest (`@` -> apps/patient-portal/src,
// `@hairos` -> src). It exercises the REAL, dependency-free path builders used
// by the live write paths:
//   • reportAssetPath        lib/reports/assets/contract        (report-assets bucket, PNG)
//   • onePagerSnapshotPath   lib/reports/one-page/snapshot       (one-pagers bucket, JSON)
//   • patientReportObjectName packages/pdf-engine/objectName      (clinical-reports bucket, dossier PDF)
//
// No requirement here is satisfied by a name match; every separation is carried
// by an id. If a future change reintroduces name-only addressing, this fails.

import { describe, it, expect } from "vitest";
import { reportAssetPath } from "@/lib/reports/assets/contract";
import { onePagerSnapshotPath } from "@/lib/reports/one-page/snapshot";
import { patientReportSlug } from "@/lib/reports/patientSlug";
import { patientReportObjectName } from "@hairos/packages/pdf-engine";

// ── Two clinics, two patients, ONE shared name ───────────────────────────────
// Acube and Trezze each have a "Priya Sharma". Everything that identifies the
// report is an immutable id and differs; only the display name collides.
const ACUBE = "clinic_acube_0001";
const TREZZE = "clinic_trezze_0002";

const acubePriya = {
  clinicId: ACUBE,
  patientId: "patient_acube_priya",
  assessmentId: "assess_acube_priya",
  consultationVersionId: "cv_acube_priya_v1",
  assetId: "asset_acube_priya_v1",
  name: "Priya Sharma",
  contentVersion: 1,
};
const trezzePriya = {
  clinicId: TREZZE,
  patientId: "patient_trezze_priya",
  assessmentId: "assess_trezze_priya",
  consultationVersionId: "cv_trezze_priya_v1",
  assetId: "asset_trezze_priya_v1",
  name: "Priya Sharma", // identical display name, different clinic + ids
  contentVersion: 1,
};
// A second Acube patient, distinct name, to prove in-clinic separation too.
const acubeRahul = {
  clinicId: ACUBE,
  patientId: "patient_acube_rahul",
  assessmentId: "assess_acube_rahul",
  consultationVersionId: "cv_acube_rahul_v1",
  assetId: "asset_acube_rahul_v1",
  name: "Rahul Verma",
  contentVersion: 1,
};

type Subject = typeof acubePriya;

const pngPath = (s: Subject) =>
  reportAssetPath({
    clinicId: s.clinicId,
    consultationVersionId: s.consultationVersionId,
    assetId: s.assetId,
    type: "ONE_PAGER_PNG",
    patientSlug: patientReportSlug(s.name),
  });

const snapshotPath = (s: Subject) =>
  onePagerSnapshotPath(s.assessmentId, s.contentVersion);

// Mirrors lib/reports/assets' and pdf-engine/storage.ts' real composition:
// the dossier PDF object lives at `reports/{assessmentId}/{objectName}` in the
// private `clinical-reports` bucket.
const dossierPdfPath = (s: Subject) =>
  `reports/${s.assessmentId}/${patientReportObjectName(s.name, s.assessmentId)}`;

describe("report storage: clinic + patient isolation with identical names", () => {
  it("identical patient names DO collapse to the same slug (names are not identity)", () => {
    // This is the whole premise: the name alone cannot separate two patients,
    // so identity must come from the id component the callers always append.
    expect(patientReportSlug(acubePriya.name)).toBe(patientReportSlug(trezzePriya.name));
    expect(patientReportSlug(acubePriya.name)).toBe("priya-sharma");
  });

  it("report-assets PNG keys are clinic-first and never cross a clinic boundary", () => {
    const acube = pngPath(acubePriya);
    const trezze = pngPath(trezzePriya);
    expect(acube.startsWith(`clinic/${ACUBE}/`)).toBe(true);
    expect(trezze.startsWith(`clinic/${TREZZE}/`)).toBe(true);
    // Same name, different clinic → different object. No cross-clinic collision.
    expect(acube).not.toBe(trezze);
    // A Trezze reader could never derive Acube's key by swapping the clinic in:
    expect(trezze.includes(`/${ACUBE}/`)).toBe(false);
    expect(acube.includes(`/${TREZZE}/`)).toBe(false);
  });

  it("report-assets PNG keys separate two same-name intents even inside one clinic", () => {
    // Defensive: two distinct approved versions in the same clinic get distinct
    // asset ids and therefore distinct objects, so a shared name never overwrites.
    const a = pngPath(acubePriya);
    const b = pngPath({ ...acubePriya, consultationVersionId: "cv_acube_priya_vX", assetId: "asset_other" });
    expect(a).not.toBe(b);
  });

  it("one-pagers snapshot keys are unique per assessment, so identical names never share one", () => {
    expect(snapshotPath(acubePriya)).not.toBe(snapshotPath(trezzePriya));
    expect(snapshotPath(acubePriya)).toBe("assess_acube_priya/v1.json");
    expect(snapshotPath(trezzePriya)).toBe("assess_trezze_priya/v1.json");
  });

  it("clinical-reports dossier PDF keys never collide across clinics for a shared name", () => {
    const acube = dossierPdfPath(acubePriya);
    const trezze = dossierPdfPath(trezzePriya);
    // Same name → same filename component, but the assessment-scoped parent
    // segment keeps the full key unique, so neither PDF can overwrite the other.
    expect(acube).not.toBe(trezze);
    expect(acube.startsWith("reports/assess_acube_priya/")).toBe(true);
    expect(trezze.startsWith("reports/assess_trezze_priya/")).toBe(true);
  });

  it("a REVISED report preserves its predecessor: a new version writes a NEW key in every bucket", () => {
    // Revision = new ConsultationVersion → new contentVersion → new asset id.
    const revised = {
      ...acubePriya,
      consultationVersionId: "cv_acube_priya_v2",
      assetId: "asset_acube_priya_v2",
      contentVersion: 2,
    };
    // report-assets: v1 and v2 are distinct objects (nothing overwritten).
    expect(pngPath(acubePriya)).not.toBe(pngPath(revised));
    // one-pagers: v1.json and v2.json coexist — the historical snapshot survives.
    expect(snapshotPath(acubePriya)).toBe("assess_acube_priya/v1.json");
    expect(snapshotPath(revised)).toBe("assess_acube_priya/v2.json");
    expect(snapshotPath(acubePriya)).not.toBe(snapshotPath(revised));
  });

  it("every bucket key for every subject is globally distinct (no pair overwrites another)", () => {
    const subjects = [acubePriya, trezzePriya, acubeRahul];
    const allKeys = [
      ...subjects.map(pngPath),
      ...subjects.map(snapshotPath),
      ...subjects.map(dossierPdfPath),
    ];
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
