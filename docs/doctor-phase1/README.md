# Doctor completion: release and onboarding gates

Audit date: 4 November 2026. Verified PR #52 head: `a697a503405e2ccceb5eb80a109edf1e1c53b1c6`.
Production was queried read-only. No identity mappings, credentials, medical records, migration ledger entries, roles or deployments were changed.

## Verified production state

| Clinic | Existing Doctor ID | Slug | Identity readiness |
|---|---|---|---|
| Yavana Skin & Hair Clinic | cmtihpjn0000x2bls3hrd9l01 | yavana-skin-hair-clinic | READY_TO_INVITE; no linked UID |
| Aesthetiq Clinic | cmtihpjta001f2blsuzrz7gqx | aesthetiq-clinic | READY_TO_INVITE; no linked UID |
| Derma Circles – Delhi | ab0380f1-0741-4439-b110-103036f7c4e0 | derma-circles-delhi | CONTACT_REQUIRED; no linked UID |
| Reniu Clinic | cmtihpjbl000f2blskrb8rh7j | reniu-clinic | READY_TO_INVITE; no linked UID |

All four clinics are active. No linked Google identity was found for these Doctor records. Neither identity column is populated.
Yavana has one clinic tenant and two active, non-deleted `ClinicLocation` rows:

- Mulund: `710524ee-b6dc-480e-9603-15196e4a0223`, slug `mulund`.
- Bandra: `419f229c-4f08-4506-ae86-209894d6b796`, slug `bandra`.

`ClinicLocation.slug`, `Assessment.clinicLocationId`, the branch unique/index definitions and assessment foreign key already exist. The branch migration has no successful ledger row. Do not rerun its raw ALTER statements or invent attribution for earlier assessments. Compare full object definitions before any future `migrate resolve`.

`ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent`, `KitPurchaseTransaction`, `KitOrderPayment` and the two payment enums are absent. JWT helper functions and the custom access-token hook exist. The unrolled-back `20260626_phase3_admin` entry remains unfinished. Existence of the hook function does not prove Auth dashboard registration or current session claims.

## Separate Google identity onboarding

The existing PKCE button, callback, `/post-login`, custom token hook and dual Doctor identity lookup are reused. No domain-based authorization, Doctor creation, admin priority change or automatic Google mapping is added.

Staging candidates authorized for preparation only: **Dr Test A / DrFACT Mumbai Test Clinic** and **Dr QA B / DrFACT Pune Test Clinic**. Both need separate verified Google identities. Obtain approval before changing either staging mapping. Production mappings require separate express approval.

1. Confirm the chosen preview's `DATABASE_URL` AND `DIRECT_URL` resolve to staging project `vbkoupvduadmcxggtnsb`; check server configuration without printing connection strings. Confirm Supabase public URL and server-side auth client target the same staging project. A browser URL, local .env, or one verified connection is insufficient. Do not write until both database connections are proven.
2. Have each account owner sign in with Google themselves. Never collect passwords, OTPs, session cookies or refresh tokens. Use two browser profiles. Record consent and ownership verification privately, with the exact Supabase user UUID from a server-side Auth query. Do not substitute the repository owner's dev-login identity.
3. Read the existing Doctor by exact ID and clinic ID; verify Doctor and Clinic active/non-deleted. Verify `auth.users.email_confirmed_at`, the exact verified email and the `auth.identities` Google provider association for that UUID. Email/domain similarity is insufficient. Reject a UUID already linked through either identity column on another Doctor.
4. Check active OrganizationMember and ClinicMember rows by UUID AND their unbound exact-email fallback. Reject either test identity if it resolves to SUPER_ADMIN, ORG_ADMIN or CLINIC_ADMIN. Preserve existing role priority; use different test identities when conflicted.
5. Prepare a private before/after mapping sheet: project, Doctor ID, clinic ID, current canonical UID, phone UID, proposed Google UUID, ownership evidence, conflict checks, operator and rollback values. Request explicit approval for those two exact mappings. Current state: **awaiting ownership verification and mapping approval**.
6. After approval, lock the two existing Doctor rows inside a transaction and recheck the above conditions. Update only `supabaseUserId` (and existing provisioning status if separately approved) with a compare-and-set against its recorded prior value. Preserve `supabasePhoneUserId`, Doctor ID, clinic ID, patient relations and memberships. A phone-first canonical identity must first be preserved in the phone column under a separately reviewed mapping; never overwrite an occupied phone slot. Abort on changed state or any cross-column duplicate. Record the approved before/after identity change through the existing audit writer in the same transaction. Do not upsert or create Doctor rows.
7. Sign out and sign in again to obtain fresh claims. Confirm DOCTOR, expected clinic and Doctor ID server-side. Do not rely on stale JWTs or user-editable metadata. Re-test the preserved phone identity.
8. Rollback: disable affected sessions through the supported Auth sign-out/revocation operation, restore only the exact approved previous mapping using compare-and-set against the newly assigned UUID, and record the reversal in the audit trail. Keep Doctor/clinical data and memberships. Validate old login and denial of the removed UID; already-issued JWTs need expiry/revocation checks, so a mapping reversal alone is not proof of global session invalidation.

## Authenticated acceptance still required

User-authorized existing preview: https://hairos-git-codex-phase-1-integ-95c026-diveshs-projects-6230f270.vercel.app/doctor

This preview runs PR #52, not necessarily this completion branch. Record deployed SHA before attributing any result to a commit. No deployment is authorized in this task.

For Doctor A and then Doctor B, capture normal Google login, exact clinic/patient list, own review, refresh and logout; `/admin` must deny entry. Check server API denial and report retrieval denial for the other clinic, including supplied patient/assessment/order IDs. Save typed and dictated notes, edit before save and reload; retain authored history. Approve four distinct kits, record two purchased and two deferred, repeat the same request/double-click and verify two purchased/two remaining, immutable approved version, date/provenance, payment versus patient report, dispensing and next-visit recall. Test later purchase/refund without duplicating genuine transactions. Do not mark this passed from SQL tests or a rendered login page.

Yavana URLs are `/q/yavana-skin-hair-clinic?branch=mulund` and `?branch=bandra`. Accept QR codes only after an authorized staging submission at each route persists the correct location, preserves one clinic/Doctor and filters correctly under Mulund/Bandra/All. Production submissions are not authorized.

For all four clinics require assessment ownership, processing, consultation approval, governed kit sequence, approved report reopening/download and authenticated isolation. WhatsApp requires an authorized recipient/send, provider message ID and accepted status, callback status where supported, timestamps and persisted audit. URL success is not delivery evidence. No external message was sent in this task.

## Additive migration execution proposal — NOT authorization

The SQL files here are review candidates, not a Prisma migration series and not a fully reconciled Production release. Historical migration files remain unchanged. The exact candidate SQL is tested against a disposable PostgreSQL engine, not a restored Production clone.

1. Obtain a restore-tested backup and export baseline counts, constraints, grants, policies, helper definitions and complete migration ledger. Run `00-read-only-preflight.sql` on the intended target. Reconcile every relevant object against its canonical migration, including the existing branch objects and unfinished admin entry. Do not blindly mark an entire migration applied because one object exists; do not copy old fake-checksum ledger inserts. Do not run `prisma migrate deploy`.
2. Review `01-payment-prerequisite.sql`: exact two payment enum definitions and payment-table/index/FK statements extracted from `20260829_post_approval_workflow`, with RLS and public/browser access revoked. This is a subset; it does NOT complete that migration's fulfilment, treatment-start or WhatsApp schema. Reconcile those separately before enabling their workflows. Do not mark the whole source migration applied.
3. Review `02-notes-and-ledger.sql`: exact original notes/ledger DDL wrapped in a transaction, then revoke browser mutations before commit. Notes are authored through the existing clinic-scoped server route, preventing a browser from forging another Doctor's attribution through direct Data API writes. Review existing policies and server DB ownership alongside grants.
4. Review `03-partial-checkout.sql`: unchanged canonical transaction/integrity/RLS candidate. It retains its STAGING-ONLY source header; this copy is not promoted by inclusion here. Execute after the first two units commit because enum additions have transaction visibility rules. Rehearse on a restored isolated clone first, run all integrity and role tests, then obtain separate Production approval for the exact checksums. Keep purchasing disabled until authenticated acceptance succeeds.
5. Run `04-verify.sql`, compare counts and hashes of preexisting patient/Doctor/consultation/order records, test anon and real Doctor A/B role access, cross-clinic read/write denial, retries and immutable approved plans. Verify migrations in the Prisma ledger using real checksums only after complete canonical object reconciliation. This package intentionally contains no ledger writes.
6. Production approval checklist: verified target and both connection endpoints; backup restore evidence; reconciled admin/branch/payment ledger; exact SQL/checksums reviewed; restored-clone rehearsal; role/RLS tests; authenticated acceptance; purchasing gate; rollback owner/window; explicit approval. All remain release gates, not inferred consent.

Rollback is application-first: restore previous app/config and keep purchasing disabled, retain all additive tables and clinical/financial history, revoke affected sessions/mappings only under their separate approval. Do not DROP populated notes or financial tables. If any SQL unit fails before commit, ROLLBACK that unit; retain earlier committed additive units and diagnose. After writes, use a reviewed forward repair or isolated backup restore with audit reconciliation, never destructive table drops or fabricated migration history.

## Remaining release decision

**NO-GO for Production.** Staging Google mappings/ownership, real Doctor A/B browser acceptance, full Production schema/ledger reconciliation, report retrieval and provider delivery evidence are outstanding. Code tests cannot satisfy those gates.
