import { redirect } from "next/navigation";
import { getAuthClaims } from "@/lib/auth";
import { doctorAuthIdentityWhere } from "@/lib/auth/doctorIdentity";
import { prisma } from "@/lib/prisma";
import { loadDashboardStats } from "@/lib/doctor/dashboardStats";
import { DoctorDashboardClient } from "./DoctorDashboardClient";
import "@/styles/doctor-tokens.css";

export const dynamic = "force-dynamic";

// Doctor Dashboard — resolved on the SERVER.
//
// ── Why the data is read here ───────────────────────────────────────────────
// The dashboard used to render an empty shell and then, once its JavaScript
// had downloaded and hydrated, ask /api/doctor/stats and /api/doctor/me what
// to draw. Opening the page therefore ran server-render → bundle → hydrate →
// two API round trips → paint, strictly in series, with a grey skeleton on
// screen for all of it. On the one page a clinician glances at forty times a
// day, that is the whole experience.
//
// The server can authenticate and run the query while the browser is still
// downloading the bundle, so it does. Both requests are gone from the critical
// path: the identity comes from the Doctor row we already have to read to
// authorise the page, and the counts come from the same loader the polling
// route uses. The client still polls every 15 seconds — it simply no longer
// needs a round trip to show the first frame.
export default async function DoctorDashboardPage() {
  const claims = await getAuthClaims();
  // The Doctor layout has already resolved and guarded this session; a missing
  // claim here means the session died between the two, so start over rather
  // than render a clinical surface for nobody.
  if (!claims?.sub) redirect("/login");

  const doctor = await prisma.doctor.findFirst({
    where: { ...doctorAuthIdentityWhere(claims.sub), isActive: true, deletedAt: null },
    select: {
      name: true,
      clinicId: true,
      photoUrl: true,
      clinic: { select: { name: true } },
    },
  });
  if (!doctor) redirect("/login?reason=forbidden");

  // A failed first read must not take the page down — the client renders its
  // own error state and offers a retry against the same data it polls.
  const stats = await loadDashboardStats(doctor.clinicId).catch(() => null);

  return (
    <DoctorDashboardClient
      initialStats={stats}
      doctorName={doctor.name}
      photoUrl={doctor.photoUrl}
      clinicName={doctor.clinic?.name ?? null}
      role={claims.user_role ?? "DOCTOR"}
    />
  );
}
