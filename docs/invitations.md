# Invitation System (Phase 1.3)

End-to-end flow for inviting users into an Organization or a Clinic.

## Roles and scopes

| Inviter role | May invite into | Allowed invitee roles |
|---|---|---|
| `SUPER_ADMIN` | any organization or clinic | any |
| `ORG_ADMIN` | their own organization, or any clinic in it | `ORG_ADMIN`, `CLINIC_ADMIN`, `STAFF`, `DOCTOR` |
| `CLINIC_ADMIN` | only their own clinic | `CLINIC_ADMIN`, `STAFF`, `DOCTOR` |

DB-level CHECK constraints (`ClinicInvitation_scope_xor`, `ClinicInvitation_role_matches_scope`) enforce that:
- exactly one of `clinicId` / `organizationId` is set per row
- org-scoped rows carry only `ORG_ADMIN` or `SUPER_ADMIN`
- clinic-scoped rows carry only `CLINIC_ADMIN`, `STAFF`, or `DOCTOR`

## Token model

- Created server-side as 32 random bytes → base64url (~43 chars).
- Only `sha256(rawToken)` is stored as `ClinicInvitation.tokenHash` (`@unique`).
- The raw token is returned exactly once, in the `POST /api/admin/invitations` response. It is the entire payload of the invite link.
- TTL default 7 days, hard-capped 1 hour minimum and 30 days maximum.

## API

### `POST /api/admin/invitations` — create
Auth: `SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN` (scope-checked per inviter).

```json
// Request
{ "email": "alex@clinic.com", "role": "DOCTOR", "clinicId": "cmp...", "ttlHours": 168 }

// 201
{
  "invitation": { "id": "...", "email": "...", "role": "DOCTOR", "status": "PENDING", "expiresAt": "..." },
  "rawToken": "...43-char-string..."
}
```

Error codes (HTTP / `error`):
- `400` `missing_required_fields` · `invalid_scope` · `invalid_role_for_scope`
- `403` `forbidden` (out of scope)
- `404` `clinic_not_found` · `organization_not_found`
- `409` `duplicate_pending`

### `GET /api/admin/invitations` — list (scope-filtered)
Returns the 100 most recent invitations visible to the caller.

### `DELETE /api/admin/invitations/[id]` — revoke
Only pending invitations may be revoked. Sets `status=REVOKED`, `revokedAt=now()`.

### `GET /api/invitations/[token]` — public preview
Public endpoint; takes the raw token, returns the inviter context (clinic/organization name, role, expiry). Auto-promotes to `EXPIRED` in the response when past `expiresAt` (status is also updated on accept-attempt).

### `POST /api/invitations/[token]/accept`
Requires a signed-in Supabase session. Validates token + expiry + status + that the session email matches the invitation email, then in a single transaction:
1. Creates / updates the membership row (`Doctor`, `ClinicMember`, or `OrganizationMember`).
2. Marks the invitation `ACCEPTED` with `acceptedAt` and `acceptedBySupabaseUserId`.

The caller should refresh the JWT (sign out / back in, or `supabase.auth.refreshSession()`) to pick up the new `user_role` / `clinic_id` / `organization_id` claims via the `custom_access_token_hook`.

## Token-link format (recommended)

```
https://<host>/invite/<rawToken>
```

A landing page calls `GET /api/invitations/[token]` for preview, prompts the user to sign in / sign up via Supabase with the matching email, then `POST /api/invitations/[token]/accept`.

## Out of scope for Phase 1

- **Email delivery.** The raw token currently surfaces in the API response only. Phase 8 (Notifications) will hook into invitation creation and dispatch the link via email/SMS/WhatsApp.
- **RLS policies.** `ClinicInvitation` has RLS enabled with no policies — all access is server-side via `service_role`. Phase 1.4 will publish the policy set.
