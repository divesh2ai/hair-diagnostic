## Supabase infrastructure — canonical definitions

This directory holds Supabase-console-side infrastructure that is NOT captured
by `prisma/migrations/**` (which manages application schema only). Contents:

- `functions/custom_access_token_hook.sql` — the JWT custom claims hook that
  derives `user_role` / `clinic_id` / `organization_id` from canonical
  Prisma tables (`OrganizationMember`, `Doctor`, `ClinicMember`, `Patient`).
  This is the sole source of a request's authorization identity.

### Sync workflow

Because the hook is registered inside Supabase (Auth → Hooks →
custom_access_token) rather than through Prisma migrations, the version in
this repo is a **canonical source-of-truth mirror**. When the hook is
changed in the Supabase console:

1. Retrieve the current definition:
   ```sql
   SELECT pg_get_functiondef(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'custom_access_token_hook';
   ```
2. Overwrite the file here.
3. Commit with a description of the behaviour change.
4. Update `docs/security/authorization-specification.md` if role-precedence
   changes.

Re-applying the file to the DB uses `CREATE OR REPLACE FUNCTION`, so it is
safe to re-run any time the file diverges from what's live.

Never modify the hook in the console WITHOUT this checked-in copy being
updated in the same PR — undocumented dashboard authorization logic is
what the platform-foundation memo (2026-06-26) explicitly told us not to
allow.
