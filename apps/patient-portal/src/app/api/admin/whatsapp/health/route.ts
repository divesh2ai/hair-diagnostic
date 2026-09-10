import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { checkWhatsappConfig } from "@/lib/delivery/whatsappConfigHealth";

// GET /api/admin/whatsapp/health — Super Admin only.
//
// Answers exactly one operational question: can this deployment send a
// WhatsApp report right now? `status` is the whole answer — READY or
// CONFIGURATION_ERROR — and `missing` names which settings are absent so an
// operator can fix them, WITHOUT ever reading a credential value back: the
// list is env-var NAMES (e.g. "WHATSAPP_ACCESS_TOKEN"), never what they
// contain. See lib/delivery/whatsappConfigHealth.ts for the contract this
// checks against.

export async function GET() {
  const auth = await requireRole(SystemRole.SUPER_ADMIN);
  if (auth instanceof NextResponse) return auth;

  const check = checkWhatsappConfig();
  return NextResponse.json(check);
}
