import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { doctorAuthIdentityWhere } from "./doctorIdentity";

// Request-scoped memoization for the two reads every /doctor* surface repeats.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Opening /doctor (or any page under it) renders the Doctor LAYOUT and the
// PAGE in the same server request. Before this module each resolved the
// caller independently:
//
//   • The Supabase JWT was read twice — the layout's getClinicContext() and
//     the page's getAuthClaims() each called supabase.auth.getClaims(),
//     re-parsing cookies and re-verifying the token against JWKS.
//   • The Doctor row was read twice from Postgres with an IDENTICAL predicate
//     — loadDoctorShellData() (id, clinicId) and the dashboard page
//     (name, photoUrl, clinic.name) — on the one screen a clinician opens
//     dozens of times a day.
//
// React's cache() memoizes a function's result for the duration of a single
// server render pass and nothing longer: "React.cache is scoped to the current
// request only. Each request gets its own memoization scope with no sharing
// between requests" (Next.js docs, Fetching Data → Sharing data with
// React.cache; and the Authentication DAL guide, which recommends exactly this
// wrapper for verifySession/getUser). So the layout and the page now share one
// claims read and one Doctor read, with no behavioural change and no risk of a
// value leaking across requests.
//
// Nothing here changes WHAT is read or WHO is authorised — only how many times
// the same read runs inside one request. Both call sites already used the same
// canonical predicate (`doctorAuthIdentityWhere(sub)` + isActive + not
// soft-deleted); the select here is their union so either caller is satisfied.

/**
 * The verified Supabase claims for the current request, read at most once.
 * Returns the raw `{ data, error }` from `getClaims()` so every caller keeps
 * its own interpretation of a missing/invalid session.
 */
export const readSupabaseClaims = cache(async () => {
  const supabase = await createSupabaseServerClient();
  return supabase.auth.getClaims();
});

/**
 * The live Doctor row for a Supabase identity, read at most once per request.
 *
 * Predicate is the canonical one shared by the layout guard and the API
 * boundary: EITHER linked Supabase identity, active, not soft-deleted. The
 * select is the union of what the layout and the dashboard page each need, so a
 * single query answers both. Returns null when no live Doctor row matches —
 * callers decide where to route.
 */
export const resolveDoctorIdentity = cache(async (supabaseUserId: string) => {
  return prisma.doctor.findFirst({
    where: {
      ...doctorAuthIdentityWhere(supabaseUserId),
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      clinicId: true,
      name: true,
      photoUrl: true,
      clinic: { select: { name: true } },
    },
  });
});
