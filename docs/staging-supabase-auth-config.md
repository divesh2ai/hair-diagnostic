# Staging Supabase Auth — manual configuration

Everything in this file must be entered by hand in the Supabase dashboard for the
**staging** project `vbkoupvduadmcxggtnsb`. None of it can be applied from this
repository: the Supabase CLI on this machine is not authenticated
(`supabase login` has never been run, no `SUPABASE_ACCESS_TOKEN` is set), and the
Supabase MCP tools available here expose SQL and project metadata only — they
carry no Auth-configuration surface. There is deliberately no code workaround;
the application side is already correct.

Do not apply any of this to the production project.

---

## 1 — Magic Link email template (send the code, not a link)

**Authentication → Emails → Templates → Magic Link**

The template currently renders `{{ .ConfirmationURL }}`, which is why the mail
arrives as a link. The application verifies a typed code (`verifyOtp`), so the
mail must expose `{{ .Token }}` instead.

Subject:

```
Your Dr FACT sign-in code
```

Body:

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
        <tr>
          <td style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0E7C7B;font-weight:600;">
            Dr FACT · HairOS
          </td>
        </tr>
        <tr>
          <td style="padding-top:12px;font-size:20px;font-weight:600;color:#111827;">
            Your sign-in code
          </td>
        </tr>
        <tr>
          <td style="padding-top:8px;font-size:15px;line-height:1.5;color:#4b5563;">
            Enter this code in the Dr FACT sign-in screen to continue.
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 0;">
            <div style="display:inline-block;font-size:32px;letter-spacing:.18em;font-weight:700;color:#111827;background:#f3f4f6;border-radius:8px;padding:16px 24px;">
              {{ .Token }}
            </div>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:1.6;color:#6b7280;">
            The code expires shortly. If you did not request it, you can ignore
            this email — no one can sign in without it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

Do **not** keep `{{ .ConfirmationURL }}` anywhere in the body. A link and a code
in the same mail invite the recipient to click, which lands them on a redirect
flow the application does not implement.

**Verified against the live project:** Supabase currently emits an **8-digit
numeric** token for this project, and the login screen accepts 6–10 digits
(`pattern="[0-9]{6,10}"` in `apps/patient-portal/src/app/login/page.tsx`), so the
code will paste in cleanly. No frontend change is needed.

---

## 2 — URL configuration

**Authentication → URL Configuration**

### Site URL

Currently `http://localhost:3000`, which is the sole source of that host — the
application contains no such hardcoding and sends no `emailRedirectTo`.

This staging project has no stable application URL today: every deployment is a
CLI preview with a fresh hostname, and the one stable host in the account,
`https://hairos-ashen.vercel.app`, is the **production** deployment and runs
against the **production** Supabase project. Pointing staging's Site URL there
would be wrong.

Two options, in order of preference:

1. **Give staging a stable hostname, then use it.** From the repo root:

   ```bash
   npx vercel alias set hairos-q2shxh2h7-diveshs-projects-6230f270.vercel.app hairos-staging.vercel.app
   ```

   then set Site URL to `https://hairos-staging.vercel.app`. Re-point the alias
   after each deploy and the Supabase config never has to change again.

2. **Use the current preview URL** —
   `https://hairos-q2shxh2h7-diveshs-projects-6230f270.vercel.app` — and accept
   that it needs updating whenever a new preview becomes the one under test.

Either way: not `http://localhost:3000`.

Note that in the OTP flow Site URL is close to inert — no link is followed, the
patient types a code — so this is hygiene rather than a functional blocker.

### Redirect URLs

Add:

```
https://*-diveshs-projects-6230f270.vercel.app/**
http://localhost:4000/**
```

Leave any existing production entries in place. Do not add `*` or
`https://**`.

---

## 3 — SMTP

**Project Settings → Authentication → SMTP Settings** (enable *Custom SMTP*)

The built-in Supabase sender is rate-limited to roughly two messages an hour,
which is what produced the `429 email rate limit exceeded` on `/auth/v1/otp` in
the Auth logs. That ceiling is a property of the shared sender, not of the
application: the frontend already holds a submit lock, a cooldown and explicit
429 handling, and nothing in the app should try to work around it.

Credentials cannot be invented here, and none exist in the environment or the
repository. Create a Resend account, verify a sending domain, and enter:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_…`) |
| Sender email | e.g. `no-reply@<your-verified-domain>` |
| Sender name | `Dr FACT` |

Keep the API key in the Supabase dashboard only. It does not belong in this
repository, in `.env`, or in any source file.

### One thing SMTP will not fix

The three staging QA identities use a non-routable domain:

- `admin.qa@drfact.staging`
- `dr.test.a@drfact.staging`
- `dr.qa.b@drfact.staging`

`.staging` is not a real TLD, so no provider — Resend, Postmark, SES or anyone
else — can ever deliver to those addresses. Configuring SMTP will not make an
OTP email arrive for them.

To test real email delivery end to end, use `divesh2ai@gmail.com`, which already
exists as an auth user in this project. The `.staging` accounts remain the right
identities for authorization testing, which does not depend on email at all.
