// Prisma implementation of ConsultationRepo. Every mutation that produces an
// immutable version also writes its outbox events in the same transaction so
// "the event was emitted iff the version was persisted" is a hard guarantee.

import type { PrismaClient, Prisma } from "@prisma/client";
import type { Consultation } from "@shared/types/consultation";
import type { ApprovalStatus, ConsultationRepo, StoredVersion, VersionMetadata } from "../ports";
import type { ConsultationEvent } from "../events/types";

export function prismaConsultationRepo(prisma: PrismaClient): ConsultationRepo {
  return {
    async getLatestByAssessment(assessmentId) {
      const consultation = await prisma.consultation.findUnique({
        where: { assessmentId },
        include: { currentVersion: true },
      });
      if (!consultation || !consultation.currentVersion) return null;
      return toStored(consultation.id, consultation.clinicId, consultation.currentVersion);
    },

    async getVersion(consultationId, contentVersion) {
      const [consultation, v] = await Promise.all([
        prisma.consultation.findUnique({ where: { id: consultationId }, select: { clinicId: true } }),
        prisma.consultationVersion.findUnique({
          where: { consultationId_contentVersion: { consultationId, contentVersion } },
        }),
      ]);
      if (!consultation || !v) return null;
      return toStored(consultationId, consultation.clinicId, v);
    },

    /**
     * Create the consultation and its first version — or recover one that is
     * already half-built.
     *
     * ── The three states this has to handle ────────────────────────────────
     *  1. Nothing on disk                → create both, normal path.
     *  2. Consultation + currentVersion  → return it, compose was wasted work.
     *  3. Consultation, NO currentVersion → **orphan**. Recover it.
     *
     * State 3 used to fall straight through to `consultation.create` on a
     * column with `@@unique([assessmentId])`, so it raised P2002 — and it did
     * so on *every* subsequent request, because nothing about the failure
     * changed the row. One interrupted transaction made an assessment
     * permanently unopenable, and the doctor saw "We could not load this
     * consultation" forever.
     *
     * An orphan can also hold versions that were written before the
     * `currentVersionId` update landed. Those carry real clinical content, so
     * recovery re-points the pointer at the newest one rather than composing a
     * replacement — see `adoptOrphan`.
     */
    async createWithInitialVersion(args): Promise<StoredVersion> {
      const existing = await prisma.consultation.findUnique({
        where: { assessmentId: args.assessmentId },
        include: { currentVersion: true },
      });
      if (existing?.currentVersion) {
        return toStored(existing.id, existing.clinicId, existing.currentVersion);
      }
      if (existing) {
        return adoptOrphan(prisma, existing.id, existing.clinicId, args);
      }

      try {
        return await prisma.$transaction(async (tx) => {
          const consultation = await tx.consultation.create({
            data: {
              assessmentId: args.assessmentId,
              clinicId: args.clinicId,
              patientId: args.patientId,
              createdBy: args.actorId,
              status: "AWAITING_DOCTOR_REVIEW",
            },
          });

          const version = await tx.consultationVersion.create({
            data: {
              consultationId: consultation.id,
              contentVersion: 1,
              content: args.content as unknown as Prisma.InputJsonValue,
              engineVersions: args.engineVersions as Prisma.InputJsonValue,
              contentHash: args.contentHash,
              createdBy: args.actorId,
              ...metadataToData(args.metadata),
            },
          });

          await tx.consultation.update({
            where: { id: consultation.id },
            data: { currentVersionId: version.id },
          });

          await writeEvents(tx, consultation.id, version.id, args.events);

          return toStored(consultation.id, args.clinicId, version);
        });
      } catch (err) {
        // Two first-opens of the same assessment raced and the other one won.
        // The unique constraint is doing exactly its job; converge on the row
        // it created instead of surfacing a database error to a doctor.
        if (!isUniqueViolation(err)) throw err;

        const winner = await prisma.consultation.findUnique({
          where: { assessmentId: args.assessmentId },
          include: { currentVersion: true },
        });
        if (winner?.currentVersion) {
          return toStored(winner.id, winner.clinicId, winner.currentVersion);
        }
        if (winner) {
          // The winner is itself mid-flight or orphaned.
          return adoptOrphan(prisma, winner.id, winner.clinicId, args);
        }
        // The row is genuinely gone (rolled back between our two reads).
        // Rethrow rather than loop — the caller retries the whole request.
        throw err;
      }
    },

    async appendVersion(args): Promise<StoredVersion> {
      return prisma.$transaction(async (tx) => {
        const current = await tx.consultation.findUnique({
          where: { id: args.consultationId },
          include: { currentVersion: true },
        });
        if (!current) {
          throw new Error(`Consultation ${args.consultationId} not found`);
        }

        // Skip duplicate work — same content, same version pointer.
        if (current.currentVersion?.contentHash === args.contentHash) {
          return toStored(current.id, current.clinicId, current.currentVersion);
        }

        const nextVersion = (current.currentVersion?.contentVersion ?? 0) + 1;

        const version = await tx.consultationVersion.create({
          data: {
            consultationId: current.id,
            contentVersion: nextVersion,
            content: args.content as unknown as Prisma.InputJsonValue,
            engineVersions: args.engineVersions as Prisma.InputJsonValue,
            contentHash: args.contentHash,
            createdBy: args.actorId,
            ...metadataToData(args.metadata),
          },
        });

        await tx.consultation.update({
          where: { id: current.id },
          data: { currentVersionId: version.id, status: "REVISED" },
        });

        await writeEvents(tx, current.id, version.id, args.events);

        return toStored(current.id, current.clinicId, version);
      });
    },

    async setApproval(args) {
      return prisma.$transaction(async (tx) => {
        const version = await tx.consultationVersion.update({
          where: {
            consultationId_contentVersion: {
              consultationId: args.consultationId,
              contentVersion: args.contentVersion,
            },
          },
          data: {
            approvalStatus: args.status,
            approvedBy: args.status === "APPROVED" ? args.approverId : null,
            approvedAt: args.status === "APPROVED" ? new Date() : null,
            approvalNotes: args.notes ?? null,
          },
        });

        if (args.status === "APPROVED") {
          await tx.consultation.update({
            where: { id: args.consultationId },
            data: { status: "APPROVED" },
          });
        }

        await writeEvents(tx, args.consultationId, version.id, args.events);
        const c = await tx.consultation.findUnique({
          where: { id: args.consultationId },
          select: { clinicId: true },
        });
        if (!c) throw new Error(`Consultation ${args.consultationId} vanished mid-tx`);
        return toStored(args.consultationId, c.clinicId, version);
      });
    },
  };
}

/**
 * Recognise a unique-constraint violation without an `instanceof` check.
 *
 * The app's Prisma client is wrapped in `$extends` (see lib/prisma), and this
 * module is also driven by test doubles, so the error crossing this boundary
 * is not reliably an instance of the `PrismaClientKnownRequestError` class
 * this file could import. The code is the stable contract.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Recover a Consultation row that exists without a `currentVersionId`.
 *
 * Prefers re-pointing at an existing version over writing a new one: a version
 * that was created just before the pointer update failed holds real composed
 * clinical content, and replacing it would discard a doctor-visible record and
 * renumber the version history.
 *
 * Concurrency-safe without row locks. Two callers recovering the same orphan
 * both attempt `contentVersion = max + 1`, and `@@unique([consultationId,
 * contentVersion])` lets exactly one through; the loser re-reads and returns
 * the winner's row.
 */
async function adoptOrphan(
  prisma: PrismaClient,
  consultationId: string,
  clinicId: string,
  args: Parameters<ConsultationRepo["createWithInitialVersion"]>[0],
): Promise<StoredVersion> {
  const orphanedVersion = await prisma.consultationVersion.findFirst({
    where: { consultationId },
    orderBy: { contentVersion: "desc" },
  });

  if (orphanedVersion) {
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { currentVersionId: orphanedVersion.id },
    });
    return toStored(consultationId, clinicId, orphanedVersion);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const version = await tx.consultationVersion.create({
        data: {
          consultationId,
          contentVersion: 1,
          content: args.content as unknown as Prisma.InputJsonValue,
          engineVersions: args.engineVersions as Prisma.InputJsonValue,
          contentHash: args.contentHash,
          createdBy: args.actorId,
          ...metadataToData(args.metadata),
        },
      });

      await tx.consultation.update({
        where: { id: consultationId },
        data: { currentVersionId: version.id },
      });

      await writeEvents(tx, consultationId, version.id, args.events);

      return toStored(consultationId, clinicId, version);
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const winner = await prisma.consultationVersion.findFirst({
      where: { consultationId },
      orderBy: { contentVersion: "desc" },
    });
    if (!winner) throw err;
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { currentVersionId: winner.id },
    });
    return toStored(consultationId, clinicId, winner);
  }
}

function metadataToData(m?: VersionMetadata) {
  if (!m) return {};
  return {
    llmModel: m.llmModel ?? null,
    promptVersion: m.promptVersion ?? null,
    knowledgeBaseVersion: m.knowledgeBaseVersion ?? null,
    approvalStatus: m.approvalStatus ?? undefined,
    approvedBy: m.approvedBy ?? null,
    approvedAt: m.approvedAt ? new Date(m.approvedAt) : null,
    approvalNotes: m.approvalNotes ?? null,
  };
}

async function writeEvents(
  tx: Prisma.TransactionClient,
  consultationId: string,
  versionId: string,
  events: ConsultationEvent[],
) {
  if (events.length === 0) return;
  await tx.consultationEvent.createMany({
    data: events.map((e) => ({
      // Composition events are authored before the consultation row exists,
      // so they carry a `__pending__` sentinel. Persistence rewrites it to
      // the real consultationId here — no `__pending__` should ever land on
      // disk.
      consultationId,
      type: e.type,
      payload: e.payload as Prisma.InputJsonValue,
      consultationVersionId: e.consultationVersionId ?? versionId,
    })),
  });
}

function toStored(
  consultationId: string,
  clinicId: string,
  v: {
    id: string;
    contentVersion: number;
    content: unknown;
    contentHash: string;
    createdAt: Date;
    createdBy: string;
    llmModel?: string | null;
    promptVersion?: string | null;
    knowledgeBaseVersion?: string | null;
    approvalStatus?: ApprovalStatus | string;
    approvedBy?: string | null;
    approvedAt?: Date | null;
    approvalNotes?: string | null;
  },
): StoredVersion {
  return {
    id: v.id,
    consultationId,
    clinicId,
    contentVersion: v.contentVersion,
    content: v.content as Consultation,
    contentHash: v.contentHash,
    createdAt: v.createdAt.toISOString(),
    createdBy: v.createdBy,
    metadata: {
      llmModel: v.llmModel ?? null,
      promptVersion: v.promptVersion ?? null,
      knowledgeBaseVersion: v.knowledgeBaseVersion ?? null,
      approvalStatus: (v.approvalStatus as ApprovalStatus | undefined) ?? "PENDING_REVIEW",
      approvedBy: v.approvedBy ?? null,
      approvedAt: v.approvedAt?.toISOString() ?? null,
      approvalNotes: v.approvalNotes ?? null,
    },
  };
}
