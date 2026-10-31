# GH DERMA CENTER — GO‑LIVE VALIDATION REPORT

**Date:** 2026‑10‑26 · **Mode:** Production launch completion (P0 only, read‑only validation)
**Verdict:** **CONDITIONAL GO** — infrastructure, auth, isolation and patient→clinical‑report generation are PASS in live production; full GO is gated on one completed doctor‑review→approve→deliver cycle (see §7–8).

> Evidence basis: read‑only queries against Supabase production `pykoyxbleowxwechotth`, correlated auth/edge logs, the deployed commit on Vercel, and the user‑confirmed Incognito OTP login. No production records were created or modified in this validation. The live web pages were **not** fetched from this environment (outbound to `hairos-ashen.vercel.app` is network‑restricted here); page‑load items are evidenced via data‑layer resolution + the user's confirmed login, and are marked accordingly.

---

## 1. Production identifiers (locked)
| Field | Value |
|---|---|
| Production URL | https://hairos-ashen.vercel.app |
| Supabase project | `pykoyxbleowxwechotth` (drfact‑hairos‑production) |
| Deployed commit | `claude/acube-launch-fix` @ `0227041308bc3a86def47b0067bbe446e49de4a3` (Vercel production, READY) |
| Clinic | GH Derma Center · slug `gh-derma-center` · **ACTIVE**, isActive=true |
| Clinic ID | `c52334dd4be5b4d14b2cfc867059e0071` |
| organizationId | `null` (matches all peer clinics) |
| Doctor | Dr. Rav Sharan Singh · MBBS, MD, D.Cos · ID `c8db4c5fdd42544b1afccdd307791bf2b` · isPrimary, isActive, **provisioning ACTIVE** |
| Mobile OTP | `+919877575030` |
| Patient QR URL | https://hairos-ashen.vercel.app/q/gh-derma-center |
| Doctor dashboard | https://hairos-ashen.vercel.app/doctor |

---

## 2. Production readiness
| # | Check | Result | Evidence |
|---|---|---|---|
| 2.1 | Clinic ACTIVE & QR URL resolves to GH Derma | **PASS** | Clinic `c52334…`, slug `gh-derma-center`, status ACTIVE. A real patient intake via this slug resolved to clinicId `c52334…` (below). Live page not fetched from sandbox. |
| 2.2 | Doctor assigned to correct clinicId | **PASS** | Dr. Singh `c8db4c5f…`.clinicId = `c52334…` (GH Derma), isPrimary, isActive. |
| 2.3 | Phone OTP authentication & identity linkage | **PASS** | User‑confirmed successful mobile‑OTP login in Chrome Incognito; doctor now `provisioning=ACTIVE` with a linked Supabase auth identity. |
| 2.4 | JWT claims & session resolve to GH Derma | **PASS (by design + login success)** | `custom_access_token_hook` sets `clinic_id` = doctor.clinicId = GH Derma; successful dashboard login implies claims resolved. Claims not independently decoded. |
| 2.5 | Doctor dashboard loads | **PASS (per login evidence)** | Successful Incognito login (user‑confirmed). Not fetched from sandbox. |
| 2.6 | No cross‑clinic patients visible | **PASS** | Dashboard scopes by `doctor.clinicId` (`requireDoctorContext` + clinic scope) + RLS; GH Derma holds exactly its own 1 patient/assessment (`patient.clinicId`/`assessment.clinicId` = `c52334…`). |
| 2.7 | Existing clinics/doctors/patients unaffected | **PASS** | Clinics 7 (6 pre‑existing + GH Derma), doctors 7 (6 + Dr Singh). Only the clinic+doctor I provisioned were added; I created **no** patients. (Prod patients 13→15 reflect normal external intake, incl. GH Derma's 1 real patient.) |

---

## 3. Patient→doctor golden path (per step)
A **real** GH Derma patient intake already exists (assessment `cmvm765m600062fqscwfoq7x1`, created 2026‑10‑24, **not** test‑labelled). Front half is therefore evidenced from live production; the doctor‑action/delivery half has not occurred.

| Step | Result | Evidence |
|---|---|---|
| Patient opens GH Derma QR URL | **PASS** | Real intake created via `gh-derma-center`. |
| Questionnaire loads | **PASS** | Assessment created and progressed. |
| Completes & submits | **PASS** | `submitted=true`, assessment `status=COMPLETED`. |
| Submission resolves to GH Derma canonical clinicId | **PASS** | assessment & patient `clinicId` = `c52334…`. |
| Report (consultation) generated | **PASS** | Consultation exists; current version composed; `status=AWAITING_DOCTOR_REVIEW`. (Patient‑facing one‑pager `ReportAsset` renders on approval.) |
| Report appears in Dr. Singh's dashboard review queue | **PASS (by data + scoping)** | AWAITING_DOCTOR_REVIEW consultation in GH Derma = the queue item his dashboard lists. Not visually confirmed. |
| Doctor opens patient report | **NOT TESTED** | Requires the doctor's live action. |
| Doctor review / approve / modify | **NOT TESTED / BLOCKED** | Only a real patient exists and is `PENDING_REVIEW`; I must not approve a real patient's clinical report, and no synthetic test is authorized. |
| Approved report accessible | **NOT TESTED** | Depends on an approval. |
| Recommended kits & catalog prices correct | **NOT TESTED** | `KitOrderIntent=0` (order is created on approval). |
| WhatsApp sharing | **NOT TESTED / BLOCKED** | 0 deliveries; sending to a real patient is prohibited without separate authorization + controlled destination. |
| Patient report/PDF links resolve | **NOT TESTED** | `ReportAsset=0` so far. |

---

## 4. Doctor dashboard validation
| Check | Result | Evidence |
|---|---|---|
| Correct doctor name & clinic identity | **PASS** | Dr. Rav Sharan Singh · GH Derma Center. |
| Accurate patient list & assessment status | **PASS (by data)** | 1 assessment, status AWAITING_DOCTOR_REVIEW, scoped to GH Derma. |
| Report review & approval actions | **NOT TESTED** | Requires a review cycle (see §3). |
| Approved report retrieval | **NOT TESTED** | — |
| Clinic‑specific kit/cart display | **NOT TESTED** | No order until approval. |
| Correct clinic isolation | **PASS** | clinicId scoping + RLS; GH Derma sees only its own records. |
| No duplicate/unrelated clinic records | **PASS** | `slug` unique; exactly one GH Derma clinic; no name/slug duplicates. |

---

## 5. QR poster verification
| Check | Result | Evidence |
|---|---|---|
| QR image decodes to the exact URL | **NOT TESTED** | No poster image was supplied to scan. Expected string: `https://hairos-ashen.vercel.app/q/gh-derma-center`. |
| Production route for that URL loads the correct clinic | **PASS** | `/q/gh-derma-center` → `findUnique({where:{slug}})` → GH Derma (`c52334…`); proven by the real intake that resolved to this clinicId. |

---

## 6. Authentication closeout
- **Recorded:** mobile OTP **failed in normal Chrome but succeeded in Chrome Incognito.** Root cause (diagnosed read‑only): the verify request never reached Supabase in normal Chrome — the OTP *send* (`POST /auth/v1/otp`) returned 200 from the browser, but **no `/auth/v1/verify` request appeared at the edge**, i.e. a **client‑side block before the verify call** (consistent with a browser extension/privacy tool). Deployed code = inspected commit; the verify call is correct (`verifyOtp({phone:+919877575030, token:<6 digits>, type:'sms'})`). Incognito (extensions off) removed the block → success.
- **Treated as non‑blocking** per instruction, since Incognito gives reliable clinical access.
- **Preserved:** Supabase Auth config, JWT hook, and auth identities — **no changes made**; no pre‑linking or user recreation.
- **Minor, non‑blocking observation (optional, separate):** GoTrue logs show the project's Site URL as `http://localhost:3000`; recommend setting it to `https://hairos-ashen.vercel.app` at some point. Does not affect phone‑OTP verify.

---

## 7. Outstanding blockers
1. **Doctor‑review→delivery half of the golden path is UNPROVEN** (open report → approve/modify → kits+prices → report asset/PDF → WhatsApp). This is the single gate to FULL GO.
2. **WhatsApp/PDF delivery not demonstrated** (and must use a controlled, test‑labelled destination — never a real patient without authorization).
3. **Operational note (real patient waiting):** a **real** GH Derma patient has been **AWAITING_DOCTOR_REVIEW since 2026‑10‑24**. Dr. Singh should review it promptly; completing that review also happens to exercise the untested back half of the path.

---

## 8. Final recommendation — **CONDITIONAL GO**
Do **not** declare full GO on clinic existence + OTP alone. What is proven in live production: clinic ACTIVE, doctor assigned & authenticated, JWT/claims + isolation correct, existing tenants unaffected, and **patient QR → questionnaire → submit → canonical clinicId → clinical report generation** (real patient). What remains to prove the critical path end‑to‑end: **one completed doctor review→approve→deliver cycle** with correct kits/prices and a controlled WhatsApp/PDF delivery.

**To convert to FULL GO, choose one (your authorization needed):**
- **(A)** Dr. Singh reviews/approves the existing awaiting patient in the dashboard; I then verify (read‑only) that the order/kits, report asset, and (controlled) delivery resolved correctly; **or**
- **(B)** Authorize me to create **one clearly‑labelled synthetic GH Derma patient** and specify a **controlled test destination** for WhatsApp/PDF, and I run the full golden path and report PASS/FAIL per step.

No further production changes will be made without that explicit approval.
