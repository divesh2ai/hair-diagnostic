# Schema-change proposals — for separate approval

These are **proposals only**. Nothing here has been applied. No migration was
written or run. Each is the minimal change needed to replace an inference or a
name-based heuristic with a durable, trustworthy fact. Do not apply without
explicit authorization; apply to **staging first**, never directly to production.

---

## Proposal A — Clinic rollout stage (replaces "ACTIVE == launched")
**Problem:** `Clinic.status` conflates "database enabled" with "launched". There
is no field that records where a clinic is in rollout, so the dashboard cannot
truthfully show REGISTERED / ONBOARDING / TESTING / LIVE / PAUSED and falls back
to "Verification pending".

**Proposed (additive, non-breaking):**
```prisma
enum ClinicRolloutStage {
  REGISTERED
  ONBOARDING
  TESTING
  LIVE
  PAUSED
}

model Clinic {
  // ...existing fields unchanged...
  rolloutStage   ClinicRolloutStage @default(REGISTERED)
  rolloutStageAt DateTime?          // when it last changed, for audit
}
```
- Keep `status` as-is (database enablement). `rolloutStage` is a separate axis.
- **Backfill is a human decision, not a script default:** do not auto-set LIVE
  from `status = ACTIVE`. Seed everything to `REGISTERED` and let an operator
  promote with evidence. The 13 real staging clinics are almost all registered
  shells today (no provisioned doctor, no patients), so a blanket LIVE backfill
  would recreate the exact problem this fixes.

## Proposal B — Golden-path verification record (enables OPERATIONALLY VERIFIED)
**Problem:** the operational tier can only ever read "Verification pending"
because no trustworthy end-to-end verification record exists, and it must never
be inferred from Assessment/ReportAsset/WhatsappDelivery rows (activity ≠
verification).

**Proposed (additive):**
```prisma
model ClinicVerification {
  id          String   @id @default(cuid())
  clinicId    String
  clinic      Clinic   @relation(fields: [clinicId], references: [id])
  verifiedAt  DateTime
  verifiedBy  String   // operator identity
  method      String   // e.g. "golden-path-run"
  evidenceRef String?  // link to the run / checklist artifact
  createdAt   DateTime @default(now())
}
```
`classifyClinicReadiness({ verificationRecord: true })` already flips to
VERIFIED when such a record is present — the classifier is ready for this source
the moment it exists.

## Proposal C — Durable test/demo tagging (replaces name heuristics)
**Problem:** test/demo separation currently relies on explicit markers in
name/slug/id (`lib/admin/testData.ts`). That is correct and conservative, but a
durable flag is stronger and removes the "uncertain" bucket.

**Proposed (additive):**
```prisma
model Clinic {
  // ...existing fields unchanged...
  isTestData Boolean @default(false)
}
```
- Migration guidance: set `isTestData = true` for the two confirmed test clinics
  (`drfact-mumbai-test`, `drfact-pune-test`/`staging-qa-clinic-b`) **in staging
  only**, after a human confirms `drfact-mumbai` (uncertain). The classifier can
  then prefer the flag and treat the name heuristic as a fallback for un-tagged
  rows.
- **Never set this in production** unless a real test clinic is ever created
  there (none exists today).

---

### Rollout order if approved
1. Apply Proposal C to **staging**, tag the 2 confirmed test clinics, verify the
   dashboard excludes them via the flag.
2. Apply Proposal A to staging; leave all clinics REGISTERED; let operators
   promote real clinics with evidence.
3. Apply Proposal B when a golden-path verification process produces records.
4. Only then consider the same migrations on production, each reviewed separately.
