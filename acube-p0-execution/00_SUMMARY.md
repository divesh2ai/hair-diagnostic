# Acube Aesthetics — P0 Execution Status (for review)

Date: 2026-10-13 · Branch: `claude/acube-aesthetics-p0-0odx3g` · All work is **review/analysis**; no
clinical logic changed, PR #24 unmerged, production untouched, Dr Avinash held at `CONTACT_REQUIRED`.

| Area | What I did | What needs YOUR decision |
|---|---|---|
| **RAG assistant** | Excluded — no work done, as instructed. | — |
| **Clinical engine** | Produced six exact scenarios with before/after for each proposed correction, measured empirically against throwaway engine copies. **No approved medical logic modified.** → `01_CLINICAL_ENGINE_SCENARIOS.md` | Scenario-by-scenario sign-off. I did **not** apply a global `primaryFloor` reduction or any androgen removal. |
| **Doctor OTP** | Verified the full phone-OTP login + linking path; wrote the precise activation procedure. Dr Avinash stays `CONTACT_REQUIRED`. → `02_DOCTOR_OTP_ACTIVATION.md` | Provide the verified mobile number; then authorise staging activation. |
| **Staging** | Ran all non-Preview tests (2517 pass / 15 fail / 117 skip). Documented E2E prerequisites. Live Preview not used. → `03_STAGING_VERIFICATION.md` | Authorise staging configuration (dashboard actions) before the E2E can run. |
| **Installation** | Minimal synthetic-data demo checklist + exact Vercel/Supabase dashboard actions and blockers. → `04_CLINIC_DEMO_CHECKLIST.md` | Approve staging config; pick Acube vs drfact-mumbai demo clinic. |

## The headline findings

1. **The clinical blocker is a never-finished calibration, not a regression.** 10 of the 15 suite
   failures are one family: a single confirmed dominant cause (PCOS 27.6, Hypothyroid 27.6, Iron 28.29)
   scores **below `primaryFloor:35`**, and the catalog declares **no `excludes`**, so Alopecia Areata
   cannot demote Androgen. Engine + tests were born together in WIP commit `a45f51f` and never passed.

2. **Your two non-authorisations are well-founded, and the measurements prove it:**
   - A **global `primaryFloor` reduction** (35→27) would lower the PRIMARY bar for all 21 causes, elect
     primaries the engine itself calls **LOW confidence**, and **still not fix the autoimmune scenario**.
   - **Automatic removal of androgen under autoimmune** is unnecessary and unsafe. The engine's native
     `excludes` mechanism **demotes** Androgen (47.27→31.77) while **keeping it as a coexisting SECONDARY**
     — which is exactly "preserve clinically supported coexisting causes."

3. **No single correction fixes everything.** PCOS/thyroid/iron need a floor or calibration change;
   the autoimmune case needs the `excludes` demotion; the multifactorial case needs a separate fallback.
   I've laid out a more surgical alternative (per-cause calibration instead of a global floor drop) in
   `01_…` §5 — modelled on request, not applied.

4. **The four integrated corrections (#18/#19/#20/#21) are clean** — their added tests pass in-sandbox;
   they introduce no regressions. The NO-GO is entirely the clinical-engine family + pending staging E2E.

## Hard holds (unchanged, as instructed)

- PR #24: **unmerged**, draft, `mergeable_state: clean`.
- Production: **untouched**; no production credentials or patient data used.
- Dr Avinash Agarwal: **`CONTACT_REQUIRED`** until you supply the verified number.
- Approved clinical/medical logic: **unmodified** pending your scenario review.

## Fastest path to a valid demo

1. You sign off the clinical corrections scenario-by-scenario (doc 01) → I apply only what you approve.
2. You configure staging (doc 04 dashboard actions) → I run the assessment-to-report E2E on staging with
   the synthetic cohort.
3. You provide Dr Avinash's verified number → I activate OTP on staging (doc 02).

Read next: `01_CLINICAL_ENGINE_SCENARIOS.md` is the one that needs your decision first.
