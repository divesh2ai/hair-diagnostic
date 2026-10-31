# Release 2 — automated Doctor acceptance (gates 2, 3, 6)

Genuine automated acceptance. The **only** manual steps are: log in privately as
the doctor, and open one synthetic test patient's review page. Everything else
is automated and self-reports **PASS/FAIL** to `results.jsonl` with checkpoint
screenshots. **No passwords, OTPs, cookies, or secrets** are ever read, written,
or logged. The dev-login bypass is never used.

Authored against frozen PR #35 `0b0c8c5`. It was written in a network-restricted
sandbox that cannot reach the app, so **you run it** on a machine that can; it
asserts and reports on its own.

## Fail-closed preconditions (checked first, abort on failure)
- Preview reachable.
- **Served revision pinned to 0b0c8c5** by TWO independent checks: the `x-vercel-deployment-url` header (when present) **and** the Next.js `buildId` of the running page compared against the immutable `hairos-r1dxbok0x-…` (0b0c8c5) deployment fetched server-side. Aborts if neither can confirm.
- **Backend = staging**: the running page must only ever call the staging Supabase host (`vbkoupv…`); any contact with the production host (`pykoyx…`) fails the run (gate 6, secret-free — replaces the old env-dump check).
- **Authenticated identity pinned**: `/api/doctor/me` must return `doctor.id` + `clinic.slug` matching the expected staging doctor/clinic (Dr Test A → `cmsuip6ue0006u6hzrn4iiwr3` / `drfact-mumbai-test`; Dr QA B → `cmsv8xwwc00016a4k4oxcpqhn` / `drfact-pune-test`). Mismatch is a mandatory FAIL.
- **Exit code** is nonzero if any mandatory check FAILs; `SKIP`/`MANUAL` never count as PASS.

## Setup (PowerShell, once)
```powershell
npm init -y
npm install -D playwright
npx playwright install chromium
```

## Gate 2 — Dr Test A (synthetic patient, inside the test clinic)
```powershell
node run-acceptance.mjs --role doctorA --out evidence-doctorA
```
1. A browser opens at the preview `/login`. **Log in privately as Dr Test A** (normal auth).
2. When prompted, **open one SYNTHETIC test patient's review page with an approved 4-kit plan** (`…/doctor/reports/<id>`). Dr Test A's clinic *is* a test clinic — all patients are synthetic. The kit then runs automatically and asserts:
   - notes panel enabled; **typed note saved**; **persists after reload**; **dictation control present** (PASS) — genuine speech recognition is logged **MANUAL** (human-mic check), never a pass;
   - **exactly 4 recommended kits**; **records 2 clinic-confirmed purchases** (asserts `purchasedKits=2`); **defers 2** (asserts `deferredKits=2`); **remaining correct** (2 purchased / 2 deferred / 0 remaining of 4);
   - **purchasing gated OFF** — checkout asserted disabled; payment / later-purchase / refund reported **MANUAL** (not automated), never PASS;
   - navigates to the **actual patient profile** and asserts the **saved note** and **kit history** render there.

Note the patient and assessment IDs from the URL bar for gate 3.

## Gate 3 — Dr QA B (separate clinic, assert denial)
```powershell
node run-acceptance.mjs --role doctorB --out evidence-doctorB `
  --cross-url "https://<preview>/doctor/reports/<DrTestA-assessment-id>" `
  --cross-api "/api/doctor/patients/<DrTestA-patient-id>"
```
Log in privately as **Dr QA B**. The kit asserts the Doctor-A API path returns **403/404/401 or empty 200** (no rows) and the Doctor-A page is **denied** (≥400 or a login/forbidden screen). A rendered page or returned rows = **FAIL (leak)**.

> The money path (clinic-counter payment, later purchase, refund) is **not automated** in this kit and is reported **MANUAL** — it is never claimed as passed. It stays gated by `PURCHASING_ENABLED` and is out of scope for this acceptance.

## Output / what to send back
- `evidence-doctorA/results.jsonl` + screenshots, `evidence-doctorB/results.jsonl` + screenshots.
- `api-results.jsonl` (method + status + path only).
Exit is **nonzero on any mandatory FAIL**; `SKIP`/`MANUAL` never count as PASS. All mandatory checks PASS (money steps show MANUAL) ⇒ gates 2/3/6 closed. Any FAIL ⇒ fix the actual issue and rerun only that role. When green, I'll hand over the exact production migration + deploy commands (purchasing stays OFF).

## Flags
`--base <url>` override preview · `--role doctorA|doctorB` · `--out <dir>` · `--cross-url` / `--cross-api` (gate 3).
