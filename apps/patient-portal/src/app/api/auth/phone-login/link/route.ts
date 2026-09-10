import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOrLinkDoctorByPhone } from "@/lib/auth/phoneDoctorLink";

export const dynamic = "force-dynamic";

// POST /api/auth/phone-login/link
//
// Called by the client immediately after supabase.auth.verifyOtp({ phone })
// succeeds, while the fresh session cookie from that verification is
// already attached to this request. Reads the CALLER'S OWN verified phone
// from the Supabase session (never from the request body — a body field
// would let an authenticated-but-unregistered caller claim someone else's
// number) and resolves/links the matching Doctor row.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error || !user || !user.phone) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await resolveOrLinkDoctorByPhone({
    supabaseUserId: user.id,
    verifiedPhone: user.phone,
  });

  if (!result.ok) {
    const status = result.reason === "unregistered" ? 403 : 409;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    doctorId: result.doctorId,
    clinicId: result.clinicId,
    alreadyLinked: result.alreadyLinked,
  });
}
