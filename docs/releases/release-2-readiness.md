# HairOS Release 2 — draft, NO-GO

Date: 30 October 2026 (Asia/Calcutta).
Existing PR: https://github.com/divesh2ai/hair-diagnostic/pull/35
Working branch: `claude/phase1-notes-partial-kit`.
Audited handoff head: `64285c2dde4797db76d66c8c02814379d50cb9b8`.
Production base: `3653bd49669bc80dc1d119499e83b91cbccfc31e`, already an ancestor of PR #35; includes releases #36 and #43.

## Audit of the inherited implementation

PR #35 already provided clinic-scoped typed/dictated consultation notes, author-only amendment API, dated purchase events, per-order recommendation lines, patient history and a follow-up link. It did not implement a selected-kit checkout. `KitOrderPayment` has one payment per order; its existing checkout could not represent later independent partial purchases. The tracker generated keys from action contents, collapsing genuine identical same-day purchases. Control PATCH overwrote line status without appending dated history. The UI did not expose continue/substitute/discontinue, and a stock return plus refund could reverse purchased quantity twice.

## Draft changes implemented

- A separate `KitPurchaseTransaction` per selected purchase, with UUID, retry key, selected box quantities, immutable governed price snapshot, INR total, receipt reference and independent PENDING/PAID/CANCELLED/REFUNDED status. Selection never alters the clinical kit lineup.
- Patient-token checkout can create PENDING selections only. A named authenticated doctor in the owning clinic records payment already collected at the clinic. This is clinic-counter checkout; no gateway charge or actual refund is initiated.
- Atomic payment confirmation appends separate purchase and payment events for selected lines only. Dispensing and treatment start remain independent. Full refund recording appends reversals once; stock return does not reverse money again.
- Order locks serialize purchase/control/payment operations. Outstanding quantity, current approval and governed prices are checked again before confirmation. Legacy whole-order payment and new partial transactions cannot both settle the same order through their supported stores.
- Unique per-action keys permit genuine repeated purchases on the same day while preserving the same key on retries. Receipt uniqueness and rollback prevent a failed second payment from leaving purchase events behind.
- External supply is explicit and never a clinic charge; patient-reported supply remains unconfirmed. Continue/defer/decline/substitute/discontinue append dated reasons and update controls atomically. Substitution is limited to a kit already on the approved plan; another kit requires the existing clinical edit and re-approval process.
- Previous notes and treatment history appear on the doctor review screen as well as patient profile. Mobile controls have larger touch targets and typed notes remain available with browser dictation.
- The new migration adds RLS-protected transaction reads, server-only financial writes and triggers validating clinic/patient/order/author associations on existing Phase 1 writes.

These are implemented code paths, not a claim of authenticated staging acceptance or clinical approval.

## Verification

| Check | Result | Scope |
| --- | --- | --- |
| Expanded blocking release suites | 492 passed, 44 files | Local; original CI gate plus notes/purchase suites and 11 new PostgreSQL integration tests |
| Purchasing guards, route scope, webhook signatures | 107 passed, 4 files | Local, separate additional CI step |
| Portal TypeScript | Passed | `npx tsc --noEmit --pretty false -p apps/patient-portal/tsconfig.json` after build artifacts settled |
| New migration + real store SQL | Passed in disposable PostgreSQL WASM | Applies the original Phase 1 SQL and new SQL; minimal surrounding base schema; not live Supabase or multi-backend concurrency proof |
| Full production build | Failed | Existing `src/app/layout.tsx` Google `next/font` loader: `Cannot read properties of null (reading '1')`; build not certified |
| Live authenticated staging workflow | Not run | No usable operator-controlled doctor browser session established; new migration not applied |
| Live microphone / mobile / accessibility / screenshots | Not completed | Browser automation stopped because it could not reliably determine the current Chrome URL for policy enforcement; no substitute screenshot is presented as live evidence |
| Staging behavioural suites | Blocked before acceptance | Their staging target guard refused an unconfigured local database target; credentials were not invented and authentication was not bypassed |

PostgreSQL tests cover selected-only pricing, pending versus purchased, duplicate retries, distinct identical same-day transactions, outstanding quantity limits, full refunds, external supply, start dates, note recall, control history, tenant isolation, RLS, denied browser payment writes, invalid approvals, cancellation, attribution rollback and receipt-collision rollback. They adapt Prisma's SQL transport; pricing and returned database results are real.

## Live environment checks

- Supabase project inventory confirms `hairos-staging` = `vbkoupvduadmcxggtnsb` and production = `pykoyxbleowxwechotth`.
- Staging Prisma ledger confirms `20261023_doctor_notes_and_partial_kit` finished 28 October 2026; checksum `427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011`. All three original tables exist with RLS; their six clinic policies were read.
- The supplied preview's public `/login` assets contain staging ref `vbkoupvduadmcxggtnsb`; no production Supabase URL was detected in those assets. Unauthenticated `/doctor` redirects to `/login`. This verifies the public client target, not the server's private DATABASE_URL.
- Production read-only catalog inspection confirms `ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent` and `KitPurchaseTransaction` are all absent. No production schema or patient data was changed.
- Staging security advisors were read before proposing DDL. They report existing base-table policy gaps; this release does not certify the entire project's security posture.

## Migration requirements

1. Staging already has the original Phase 1 migration. It still needs `20261030_partial_checkout_transactions`.
2. Production needs both `20261023_doctor_notes_and_partial_kit` and `20261030_partial_checkout_transactions`, in that order, after reviewing its actual catalog, prerequisite objects and migration ledger.
3. The new migration creates one transaction table, adds transaction/substitution links to events, adds two event enum values and four association triggers on existing/new tables. Existing real records are not rewritten. Its triggers affect future Phase 1 writes and require staging compatibility testing before promotion.
4. Automatic approval review rejected the staging DDL because enum additions and broad association triggers could disrupt existing writes, and exact staging schema approval was not established. It was not retried through another mechanism. No new migration or ledger entry was applied.
5. Once the exact SQL is approved, apply only the reviewed statements to staging, inspect resulting objects and policies, verify the file checksum, and reconcile the Prisma ledger only after proving the complete migration is installed. Do not blindly mark a partial migration applied or run every pending historical migration.

## Pending before GO

1. Approve and apply the exact new migration on staging; reconcile its ledger and verify compatibility with existing notes and purchase data.
2. Establish operator-controlled normal logins for Dr Test A and Dr QA B. Confirm preview server DATABASE_URL points to staging privately; expose neither credentials nor cookies.
3. Build/deploy the updated PR head to Preview, confirm its SHA and run authenticated acceptance: approve four kits, select two at one box each, explicitly defer the other two, confirm only the selected total, save/refresh typed and dictated notes, revisit patient history, continue/revise/substitute/discontinue with reasons, buy later approved boxes, retry requests, and record full refund plus separate stock return.
4. Test both clinics against reads and writes, including guessed IDs, payload changes, stale approvals, concurrent checkouts, same receipt reuse and refunds. Local PostgreSQL's serialized connection does not establish production concurrency behavior.
5. Verify doctor operational/payment summaries and fulfilment screens reconcile the new transaction ledger. Existing order-level summaries/queues were not comprehensively migrated to transaction-level accounting in this draft. Partial transactions deliberately do not enqueue whole-plan fulfilment.
6. Resolve/verify the Google-font build failure and obtain a green full Preview build. Run mobile/tablet/desktop, keyboard, reduced motion, network/console, overflow and accessibility checks; attach actual authenticated screenshots. Human microphone testing remains necessary.
7. If online gateway payment or partial monetary refunds are required, complete provider transaction binding/signature/sandbox validation and refund allocation. This draft supports authenticated clinic-counter collection and full refund recording only.
8. Obtain clinical/release review and explicit production migration/deploy/merge authorization. Keep purchasing disabled until that review is complete.

## Exact production sequence after those gates

Reconfirm production branch/head and preserve a compatible recoverable backup; review the exact migration files and catalog/ledger differences; obtain explicit production approval; install and verify the two migrations in order; deploy only the reviewed release SHA under separate authorization; enable purchasing only after clinic/payment acceptance; verify the selected-only flow and tenant isolation. Stop/rollback by disabling purchasing and reverting application routing to a reviewed compatible release, preserving all new operational history. Do not drop purchase or note tables as a routine rollback.

No production writes, production deployment, PR merge, or changes to PR #44/#45 were made. PR #35 remains draft. Recommendation: **NO-GO** until the pending evidence and approvals above are complete.
