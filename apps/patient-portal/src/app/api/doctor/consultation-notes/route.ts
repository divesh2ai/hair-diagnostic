// /api/doctor/consultation-notes
//
//   GET  ?patientId=…      — date-wise note history for a patient (clinic-scoped)
//   GET  ?assessmentId=…   — notes for one visit
//   POST                   — create a routine visit note
//
// Routine visit notes are deliberately NOT part of the consultation version or
// its approval lifecycle: creating one here does not mint a ConsultationVersion
// and emits no ConsultationEvent (contrast /api/consultation/[assessmentId],
// which appends an immutable version). Raw audio is never accepted or stored —
// the body is the doctor-edited transcript or typed text.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  createNote,
  listNotesForPatient,
  listNotesForAssessment,
  NOTES_NOT_PROVISIONED,
  NotesNotProvisionedError,
} from "@/lib/notes/noteStore";
import {
  normalizeInputMode,
  resolveDictationLanguage,
  validateNoteBody,
} from "@/lib/notes/noteModel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const assessmentId = url.searchParams.get("assessmentId");
  if (!patientId && !assessmentId) {
    return NextResponse.json({ error: "patientId_or_assessmentId_required" }, { status: 400 });
  }

  try {
    const notes = assessmentId
      ? await listNotesForAssessment(doctor.clinicId, assessmentId)
      : await listNotesForPatient(doctor.clinicId, patientId as string);
    return NextResponse.json({ notes });
  } catch (err) {
    if (err instanceof NotesNotProvisionedError) {
      return NextResponse.json({ error: NOTES_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode } = authResult;

  const body = (await req.json().catch(() => ({}))) as {
    patientId?: string;
    assessmentId?: string | null;
    consultationId?: string | null;
    body?: string;
    inputMode?: string;
    language?: string;
    noteDate?: string;
  };

  if (!body.patientId) {
    return NextResponse.json({ error: "patientId_required" }, { status: 400 });
  }
  const bodyError = validateNoteBody(body.body);
  if (bodyError) {
    return NextResponse.json({ error: bodyError }, { status: 400 });
  }

  // Tenant check: the patient must belong to the acting doctor's clinic. Done
  // against the typed client (Patient is provisioned), so a note can never be
  // filed against another clinic's patient by guessing an id.
  const patient = await prisma.patient.findFirst({
    where: { id: body.patientId, clinicId: doctor.clinicId },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "patient_not_found" }, { status: 404 });
  }

  // If a visit or consultation is named, it must belong to the SAME patient and
  // the authenticated clinic — otherwise a note could be filed against another
  // patient's visit, or another clinic's record, by passing a mismatched id.
  if (body.assessmentId) {
    const assessment = await prisma.assessment.findFirst({
      where: { id: body.assessmentId, clinicId: doctor.clinicId, patientId: body.patientId },
      select: { id: true },
    });
    if (!assessment) {
      return NextResponse.json({ error: "assessment_mismatch" }, { status: 400 });
    }
  }
  if (body.consultationId) {
    const consultation = await prisma.consultation.findFirst({
      where: { id: body.consultationId, clinicId: doctor.clinicId, patientId: body.patientId },
      select: { id: true },
    });
    if (!consultation) {
      return NextResponse.json({ error: "consultation_mismatch" }, { status: 400 });
    }
  }

  // noteDate may be backdated to the visit day, but never set in the future.
  let noteDate: Date | undefined;
  if (body.noteDate) {
    const d = new Date(body.noteDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }
    if (d.getTime() > Date.now() + 60_000) {
      return NextResponse.json({ error: "future_date" }, { status: 400 });
    }
    noteDate = d;
  }

  try {
    const note = await createNote({
      clinicId: doctor.clinicId,
      patientId: body.patientId,
      assessmentId: body.assessmentId ?? null,
      consultationId: body.consultationId ?? null,
      authorDoctorId: doctor.id,
      authorName: doctor.name,
      body: (body.body as string).trim(),
      inputMode: normalizeInputMode(body.inputMode),
      language: resolveDictationLanguage(body.language),
      noteDate,
    });

    await writeAuditLog({
      action: "DOCTOR_NOTE_SAVED",
      entityType: "ConsultationNote",
      entityId: note.id,
      clinicId: doctor.clinicId,
      assessmentId: note.assessmentId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: mode,
      metadata: { inputMode: note.inputMode, patientId: note.patientId },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof NotesNotProvisionedError) {
      return NextResponse.json({ error: NOTES_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}
