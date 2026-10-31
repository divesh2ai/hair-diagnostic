# Release 2 — local Doctor acceptance kit (run on your Windows machine)

Closes gates 2 & 3 (authenticated UI journey + cross-clinic denial) with **real
screenshots and API results**, on a machine that can reach the staging preview.
You log in privately in the browser — **no passwords / OTPs / cookies are ever
typed into chat or written to any file**. The kit only records screenshots you
trigger plus each API call's `method + status + path` (no bodies/headers/query).

## One-time setup (PowerShell)
```powershell
# Node 18+ required. In an empty folder, next to run-acceptance.mjs:
npm init -y
npm install -D playwright
npx playwright install chromium
```

## Gate 2 — Dr Test A journey
```powershell
node run-acceptance.mjs --out evidence-doctorA
```
A Chromium window opens at the preview `/login`. Then:
1. Log in as **Dr Test A** privately (normal staging login; `/api/dev/login` is available on staging if SMS-OTP is inconvenient — your choice, done in the browser).
2. Perform, clicking **“HAIROS capture”** (bottom-right) at each checkpoint:
   - Open a patient’s **consultation review**.
   - Add a **typed note** → save; **refresh** → confirm it persists (capture before+after).
   - Add a **microphone-dictated** note; confirm **typed fallback** works.
   - Confirm **4 recommended kits**.
   - **Select 2** kits (1 box each) for purchase.
   - Record **clinic-counter test payment**.
   - **Defer** the remaining 2 kits.
   - Reopen the patient → confirm **previous notes + kit history** on follow-up.
   - Do a **later purchase** and a **refund** (synthetic data).
3. Close the window. Evidence lands in `evidence-doctorA/`.

Note the patient **id** and assessment **id** from the URLs (`/doctor/patients/<id>`, `/doctor/reports/<assessmentId>`) — you’ll reuse them in gate 3.

## Gate 3 — Dr QA B isolation (fresh login)
```powershell
node run-acceptance.mjs --out evidence-doctorB
```
1. Log in as **Dr QA B** (separate clinic).
2. Paste Dr Test A’s patient/report URLs into the address bar:
   - `<BASE>/doctor/patients/<A-patient-id>`
   - `<BASE>/doctor/reports/<A-assessment-id>`
   Confirm each is **denied / not found / empty** → capture.
3. Confirm Dr QA B’s own lists show **none** of Dr Test A’s records → capture.
4. Close. Evidence lands in `evidence-doctorB/`.

`api-results.jsonl` should show **2xx** for Dr A’s own actions and **403/404** (or empty 200) for the cross-clinic probes.

## Gate 6 — preview private DB target (authorized Vercel access, no secrets shown)
On your machine, logged into Vercel CLI as the operator:
```powershell
vercel link                      # pick the 'hairos' project
# Show which keys exist per target WITHOUT values:
vercel env ls preview
# Prove the ref WITHOUT printing the secret (pull to a temp file, grep ref, delete):
vercel env pull .env.preview.tmp --environment=preview
findstr /C:"vbkoupvduadmcxggtnsb" .env.preview.tmp   # expect a match (staging)
findstr /C:"pykoyxbleowxwechotth" .env.preview.tmp   # expect NO match (not production)
del .env.preview.tmp
```
Record only PASS/FAIL (staging ref present, production ref absent) — do not paste the file.

## What to send back
- `evidence-doctorA/` and `evidence-doctorB/` (screenshots + `api-results.jsonl`).
- Gate 6 PASS/FAIL.
Any failure → fix it and re-run only that journey. When all pass, I’ll finalize the exact production cutover commands (migrations already prepared; purchasing stays OFF).
