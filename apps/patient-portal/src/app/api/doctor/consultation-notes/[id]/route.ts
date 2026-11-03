// /api/doctor/consultation-notes/[id]
//
//   PATCH — amend a note. The original is never overwritten: a successor row is
//           appended and the prior note is moved to AMENDED, so the record of
//           what was written survives. Author-only.

import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  amendNote,
  NOTES_NOT_PROVISIONED,
  NotesNotProvisionedError,
} from "@/lib/notes/noteStore";
import { normalizeInputMode, resolveDictationLanguage, validateNoteBody } from "@/lib/notes/noteModel";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode } = authResult;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    body?: string;
    inputMode?: string;
    language?: string;
  };

  const bodyError = validateNoteBody(body.body);
  if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });

  try {
    const outcome = await amendNote({
      clinicId: doctor.clinicId,
      id,
      authorDoctorId: doctor.id,
      authorName: doctor.name,
      body: (body.body as string).trim(),
      inputMode: normalizeInputMode(body.inputMode),
      language: resolveDictationLanguage(body.language),
    });

    if (!outcome.ok) {
      const status = outcome.reason === "forbidden" ? 403 : outcome.reason === "not_active" ? 409 : 404;
      return NextResponse.json({ error: outcome.reason }, { status });
    }

    await writeAuditLog({
      action: "DOCTOR_NOTE_AMENDED",
      entityType: "ConsultationNote",
      entityId: outcome.note.id,
      clinicId: doctor.clinicId,
      assessmentId: outcome.note.assessmentId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: mode,
      metadata: { supersedesId: outcome.note.supersedesId },
    });

    return NextResponse.json({ note: outcome.note });
  } catch (err) {
    if (err instanceof NotesNotProvisionedError) {
      return NextResponse.json({ error: NOTES_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}
