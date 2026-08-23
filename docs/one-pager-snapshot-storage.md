# One-pager snapshots in Supabase Storage

The patient's one-pager is composed on demand from the `NARRATIVES` artifact.
That is correct for a preview and wrong for a clinical record: recomputing the
sheet next year answers "what would we produce today", not "what did this
patient receive". So approval now preserves the sheet it releases.

## What is stored

A JSON envelope containing the complete one-page **view model** — every word,
number and asset reference the page renders from — plus the version it belongs
to and when it was captured. See `OnePagerSnapshot` in
`apps/patient-portal/src/lib/reports/one-page/snapshot.ts`.

**Not a PDF.** The PDF and PNG routes drive Playwright, and the Vercel build
does not install browser binaries (`vercel.json` runs `npm install` and
`prisma generate`, nothing else), so on the deployed app that path answers
`playwright_missing`. Persisting a PDF there would persist nothing. A PDF can
be regenerated from the stored view model at any time — the document derives
from the record, not the record from the document.

## Where

Bucket `one-pagers`, **private**, one object per approved version:

```
one-pagers/{assessmentId}/v{contentVersion}.json
```

The path is computed from facts already held, so nothing new is recorded to
find it again — **no column, no table, no `ArtifactType` value, no migration**.
The version in the path is what makes it immutable in practice: a revised
consultation approves as a new `contentVersion` and writes beside its
predecessor rather than over it. Uploads use `upsert: false`, so a retry never
overwrites the first write.

## Manual step required before this works

The bucket is deliberately **not** created from application code. Create it in
whichever Supabase project is canonical:

1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `one-pagers`
3. **Public bucket: OFF** — a one-pager names a patient, their diagnosis and
   their treatment. It follows `clinical-images` (private, signed URLs), never
   `doctor-avatars` (public).
4. No policies are needed for the write path: the server uploads with the
   service-role key. Add policies only if a client is ever given direct read
   access — today reads go through the API route below.

Until the bucket exists, approval still succeeds and logs:

```
[one-pager-snapshot] <assessmentId> v<n> not preserved: bucket_missing ...
```

That is by design — see "Failure is never fatal" below.

## Reading one back

```
GET /api/reports/[assessmentId]/one-page/snapshot          # current version
GET /api/reports/[assessmentId]/one-page/snapshot?version=3
```

Clinic-scoped: a member of the assessment's clinic, or a Super Admin. Enforced
in the route, because the object is fetched with the service-role key and so
bypasses any database policy. A cross-clinic caller gets `404`, not `403`, so
the response never confirms that an assessment exists elsewhere.

`404 no_snapshot` is the ordinary answer for anything approved before this
existed. Absent is not lost.

## Failure is never fatal

`saveOnePagerSnapshot` is a total function — it describes failures instead of
throwing — and runs **after** the approval transaction has committed, never
inside it. Two reasons:

- The approval, the kit order and the assessment mirror are durable by the time
  it runs. None of them may be undone because an object store was unreachable.
  A doctor who approved a case has approved it.
- A network round trip inside an open Postgres transaction holds a pooled
  connection for the duration of an HTTP call. That is how a slow bucket
  becomes a database outage.

The result is returned on `ApproveAndCreateOrderResult.snapshot` rather than
swallowed, so a caller can surface "the record of what we released was not
kept" if it ever wants to.

## Backfill

Not implemented. Consultations approved before this landed have no snapshot,
and one cannot be honestly reconstructed — recomposing them today would record
today's copy and today's kit registry under a past approval date, which is
precisely the confusion snapshots exist to prevent. If a backfill is ever
wanted it should be written as a separate, clearly-labelled reconstruction,
never presented as the original sheet.
