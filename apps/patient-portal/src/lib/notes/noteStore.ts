import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSchemaDriftError } from "@/lib/prismaErrors";
import type { NoteInputMode } from "./noteModel";

// ConsultationNote persistence, over raw SQL.
//
// Same baseline-freeze reasoning as lib/fulfilment/fulfilmentStore.ts and
// lib/payments/paymentStore.ts: `ConsultationNote` is in schema.prisma and in
// prisma/migrations/20261023_doctor_notes_and_partial_kit, which is NOT applied,
// so talking to it over the typed client would fail wherever the table does not
// exist yet. Raw SQL keeps the module compiling and the app booting either way;
// callers get NotesNotProvisionedError → 503 with a stable reason code.

export const NOTES_NOT_PROVISIONED = "notes_not_provisioned";

export class NotesNotProvisionedError extends Error {
  readonly reason = NOTES_NOT_PROVISIONED;
  constructor() {
    super(
      "ConsultationNote is not provisioned. Apply prisma/migrations/20261023_doctor_notes_and_partial_kit.",
    );
    this.name = "NotesNotProvisionedError";
  }
}

function isMissing(err: unknown): boolean {
  if (isSchemaDriftError(err)) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (meta.code === "42P01" || meta.code === "42703" || meta.code === "42704") return true;
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

export async function guardedNotes<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissing(err)) throw new NotesNotProvisionedError();
    throw err;
  }
}

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return `c${Date.now().toString(36)}${rand}`.slice(0, 25);
}

export interface NoteRecord {
  id: string;
  clinicId: string;
  patientId: string;
  assessmentId: string | null;
  consultationId: string | null;
  authorDoctorId: string;
  authorName: string;
  noteDate: string;
  body: string;
  inputMode: NoteInputMode;
  language: string;
  status: "ACTIVE" | "AMENDED" | "DELETED";
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: string;
  clinicId: string;
  patientId: string;
  assessmentId: string | null;
  consultationId: string | null;
  authorDoctorId: string;
  authorName: string;
  noteDate: Date;
  body: string;
  inputMode: NoteInputMode;
  language: string;
  status: "ACTIVE" | "AMENDED" | "DELETED";
  supersedesId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(r: RawRow): NoteRecord {
  return {
    id: r.id,
    clinicId: r.clinicId,
    patientId: r.patientId,
    assessmentId: r.assessmentId,
    consultationId: r.consultationId,
    authorDoctorId: r.authorDoctorId,
    authorName: r.authorName,
    noteDate: r.noteDate.toISOString(),
    body: r.body,
    inputMode: r.inputMode,
    language: r.language,
    status: r.status,
    supersedesId: r.supersedesId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const COLS = Prisma.sql`
  "id", "clinicId", "patientId", "assessmentId", "consultationId",
  "authorDoctorId", "authorName", "noteDate", "body",
  "inputMode"::text AS "inputMode", "language",
  "status"::text AS "status", "supersedesId", "createdAt", "updatedAt"
`;

export interface CreateNoteInput {
  clinicId: string;
  patientId: string;
  assessmentId?: string | null;
  consultationId?: string | null;
  authorDoctorId: string;
  authorName: string;
  body: string;
  inputMode: NoteInputMode;
  language: string;
  noteDate?: Date;
}

export async function createNote(input: CreateNoteInput): Promise<NoteRecord> {
  const id = newId();
  const noteDate = input.noteDate ?? new Date();
  return guardedNotes(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      INSERT INTO "ConsultationNote" (
        "id", "clinicId", "patientId", "assessmentId", "consultationId",
        "authorDoctorId", "authorName", "noteDate", "body",
        "inputMode", "language", "status", "audioRetained", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.clinicId}, ${input.patientId}, ${input.assessmentId ?? null},
        ${input.consultationId ?? null}, ${input.authorDoctorId}, ${input.authorName},
        ${noteDate}, ${input.body},
        ${input.inputMode}::"ConsultationNoteInputMode", ${input.language},
        'ACTIVE'::"ConsultationNoteStatus", false, NOW(), NOW()
      )
      RETURNING ${COLS}
    `);
    return toRecord(rows[0]);
  });
}

/**
 * Date-wise note history for a patient, scoped to the caller's clinic. Clinic
 * scope is part of the WHERE, so a doctor cannot read another tenant's notes by
 * guessing a patient id — the same discipline as the fulfilment store.
 */
export async function listNotesForPatient(
  clinicId: string,
  patientId: string,
): Promise<NoteRecord[]> {
  return guardedNotes(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ConsultationNote"
       WHERE "clinicId" = ${clinicId}
         AND "patientId" = ${patientId}
         AND "deletedAt" IS NULL
       ORDER BY "noteDate" DESC, "createdAt" DESC
    `);
    return rows.map(toRecord);
  });
}

export async function listNotesForAssessment(
  clinicId: string,
  assessmentId: string,
): Promise<NoteRecord[]> {
  return guardedNotes(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ConsultationNote"
       WHERE "clinicId" = ${clinicId}
         AND "assessmentId" = ${assessmentId}
         AND "deletedAt" IS NULL
       ORDER BY "noteDate" DESC, "createdAt" DESC
    `);
    return rows.map(toRecord);
  });
}

export async function readNoteById(
  clinicId: string,
  id: string,
): Promise<NoteRecord | null> {
  return guardedNotes(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${COLS} FROM "ConsultationNote"
       WHERE "id" = ${id} AND "clinicId" = ${clinicId}
    `);
    return rows[0] ? toRecord(rows[0]) : null;
  });
}

export type AmendOutcome =
  | { ok: true; note: NoteRecord }
  | { ok: false; reason: "not_found" | "forbidden" | "not_active" };

/**
 * Amend a note by appending a successor and moving the prior row to AMENDED, in
 * one transaction. The original text is never overwritten — the record of what
 * was written, by whom and when, survives. Only the author may amend.
 */
export async function amendNote(input: {
  clinicId: string;
  id: string;
  authorDoctorId: string;
  authorName: string;
  body: string;
  inputMode: NoteInputMode;
  language: string;
}): Promise<AmendOutcome> {
  return guardedNotes(async () => {
    return prisma.$transaction(async (tx) => {
      const current = await tx.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT ${COLS} FROM "ConsultationNote"
         WHERE "id" = ${input.id} AND "clinicId" = ${input.clinicId}
         FOR UPDATE
      `);
      const prior = current[0];
      if (!prior) return { ok: false, reason: "not_found" } as const;
      if (prior.authorDoctorId !== input.authorDoctorId) {
        return { ok: false, reason: "forbidden" } as const;
      }
      if (prior.status !== "ACTIVE") {
        return { ok: false, reason: "not_active" } as const;
      }

      const id = newId();
      const inserted = await tx.$queryRaw<RawRow[]>(Prisma.sql`
        INSERT INTO "ConsultationNote" (
          "id", "clinicId", "patientId", "assessmentId", "consultationId",
          "authorDoctorId", "authorName", "noteDate", "body",
          "inputMode", "language", "status", "supersedesId",
          "audioRetained", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${prior.clinicId}, ${prior.patientId}, ${prior.assessmentId},
          ${prior.consultationId}, ${input.authorDoctorId}, ${input.authorName},
          ${prior.noteDate}, ${input.body},
          ${input.inputMode}::"ConsultationNoteInputMode", ${input.language},
          'ACTIVE'::"ConsultationNoteStatus", ${prior.id}, false, NOW(), NOW()
        )
        RETURNING ${COLS}
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE "ConsultationNote"
           SET "status" = 'AMENDED'::"ConsultationNoteStatus", "updatedAt" = NOW()
         WHERE "id" = ${prior.id} AND "clinicId" = ${input.clinicId}
      `);

      return { ok: true, note: toRecord(inserted[0]) } as const;
    });
  });
}
