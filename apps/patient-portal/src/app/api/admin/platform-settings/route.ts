import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

const SINGLETON = "singleton";

// GET /api/admin/platform-settings — also creates the row on first read.
export async function GET() {
  try {
    await assertSuperAdmin();
    let row = await prisma.platformSettings.findUnique({
      where: { singletonKey: SINGLETON },
    });
    if (!row) {
      row = await prisma.platformSettings.create({
        data: { singletonKey: SINGLETON },
      });
    }
    // Tally storage usage from artifacts as a coarse measure (bytes of JSON
    // payloads). Cheap enough at platform scale; swap to a daily aggregate
    // when corpus grows.
    const storage = await prisma.$queryRaw<Array<{ bytes: bigint }>>`
      SELECT COALESCE(SUM(pg_column_size("content")), 0)::bigint AS bytes
      FROM "AIArtifact"
    `;
    return NextResponse.json({
      settings: row,
      storageBytes: Number(storage[0]?.bytes ?? 0),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN PLATFORM SETTINGS GET]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const patchSchema = z.object({
  platformName: z.string().min(1).max(120).optional(),
  defaultTheme: z.enum(["light", "dark", "system"]).optional(),
  defaultLanguage: z
    .enum(["EN", "HI", "MR", "GU", "PA", "TA", "TE"])
    .optional(),
  defaultWhatsappTemplate: z.string().max(200).nullish(),
  aiNotes: z.string().max(2000).nullish(),
  versionInfo: z.string().max(120).nullish(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await assertSuperAdmin();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const updated = await prisma.platformSettings.upsert({
      where: { singletonKey: SINGLETON },
      create: { singletonKey: SINGLETON, ...parsed.data },
      update: parsed.data,
    });

    // These defaults apply across every clinic, so a change here has
    // platform-wide blast radius. Field names only, not values.
    await writeAuditLog({
      action: "PLATFORM_SETTINGS_UPDATED",
      entityType: "PlatformSettings",
      entityId: updated.id,
      actorId: ctx.userId,
      actorRole: ctx.role,
      actorType: "admin",
      metadata: { fieldsChanged: Object.keys(parsed.data).sort() },
    });

    return NextResponse.json({ settings: updated });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN PLATFORM SETTINGS PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
