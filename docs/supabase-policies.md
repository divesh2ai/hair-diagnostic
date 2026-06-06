# Supabase RLS Policies (HairOS)

Apply after connecting `DATABASE_URL` to Supabase Postgres.

## Doctor role

- `Patient`: `SELECT` where `doctor_id = auth.uid()` mapped doctor
- `Assessment`: `SELECT` where `doctor_id` matches session doctor
- `AIArtifact`: `SELECT` via assessment join

## Admin role

- Full read on `Clinic`, `Doctor`, `Assessment`, `AnalyticsEvent`
- No direct patient PII export without audit log

## Patient (anonymous QR)

- Insert-only on `AssessmentResponse` during active session token
- No cross-clinic reads

## Storage

- Bucket `assessment-images`: path `{clinicId}/{assessmentId}/*`
- Bucket `reports`: path `{clinicId}/{assessmentId}/reports/*` — signed URLs only
