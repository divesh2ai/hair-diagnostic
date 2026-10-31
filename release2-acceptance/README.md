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
- **Served revision pinned to 0b0c8c5** via the `x-vercel-deployment-url` response header (expects the `hairos-r1dxbok0x-…` deployment). Aborts if it can't confirm.
- **Backend = staging**: the running page must only ever call the staging Supabase host (`vbkoupv…`); any contact with the production host (`pykoyx…`) fails the run (gate 6, secret-free — replaces the old env-dump check).

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
2. When prompted, **open one SYNTHETIC test patient's review page** (`…/doctor/reports/<id>`) in that same window. (Dr Test A's clinic *is* a test clinic — all its patients are synthetic.) The kit then runs automatically and asserts:
   - notes panel enabled; **typed note saved**; **persists after reload**; dictation control present + typed fallback verified;
   - tracker enabled with recommended kits; **records a clinic-confirmed purchase** and asserts purchased-box count **increases**; **defers** a remaining kit and asserts a deferred state shows;
   - **purchasing gated OFF** — the checkout/payment/refund path is asserted disabled and the payment / later-purchase / refund steps are reported **SKIP (gated)**, never PASS (respecting `PURCHASING_ENABLED`);
   - follow-up treatment/purchase history present.

Note the patient and assessment IDs from the URL bar for gate 3.

## Gate 3 — Dr QA B (separate clinic, assert denial)
```powershell
node run-acceptance.mjs --role doctorB --out evidence-doctorB `
  --cross-url "https://<preview>/doctor/reports/<DrTestA-assessment-id>" `
  --cross-api "/api/doctor/patients/<DrTestA-patient-id>"
```
Log in privately as **Dr QA B**. The kit asserts the Doctor-A API path returns **403/404/401 or empty 200** (no rows) and the Doctor-A page is **denied** (≥400 or a login/forbidden screen). A rendered page or returned rows = **FAIL (leak)**.

## Optional — exercise the money path (only with approved staging enablement)
The payment/refund path is gated by `PURCHASING_ENABLED`. Do **not** enable it in
production. Only if you have explicitly approved enabling purchasing **on
staging** for this test, re-run gate 2 with:
```powershell
node run-acceptance.mjs --role doctorA --out evidence-doctorA-purchasing --purchasing-scope approved
```
Then the clinic-counter payment, later purchase, and refund become assertable.
Without this flag the kit correctly refuses to claim those passed.

## Output / what to send back
- `evidence-doctorA/results.jsonl` + screenshots, `evidence-doctorB/results.jsonl` + screenshots.
- `api-results.jsonl` (method + status + path only).
All gates PASS (payment steps may read SKIP-gated) ⇒ gates 2/3/6 closed. Any FAIL ⇒ fix the actual issue, rerun only that role. When green, I'll hand over the exact production migration + deploy commands (purchasing stays OFF).

## Flags
`--base <url>` override preview · `--role doctorA|doctorB` · `--out <dir>` · `--cross-url` / `--cross-api` (gate 3) · `--purchasing-scope approved` (gated money path).
