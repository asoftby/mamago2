import { NextRequest, NextResponse } from "next/server";
import { prismaBase } from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const existing = await prismaBase.discoveryClassChip.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const nextIsDefault = body.isDefault === true;

  const updated = await prismaBase.$transaction(async (tx) => {
    if (nextIsDefault) {
      await tx.discoveryClassChip.updateMany({
        where: { surfaceKey: "CLASSES", NOT: { id } },
        data: { isDefault: false },
      });
    }

    return tx.discoveryClassChip.update({
      where: { id },
      data: {
        title: typeof body.title === "string" ? body.title : existing.title,
        slug:
          existing.isSystem && existing.slug === "all"
            ? existing.slug
            : typeof body.slug === "string" && body.slug.trim()
              ? body.slug.trim().toLowerCase()
              : existing.slug,
        description:
          body.description === null || typeof body.description === "string"
            ? body.description
            : existing.description,
        icon:
          body.icon === null || typeof body.icon === "string"
            ? body.icon
            : existing.icon,
        sortOrder: Number.isFinite(Number(body.sortOrder))
          ? Number(body.sortOrder)
          : existing.sortOrder,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
        isDefault: typeof body.isDefault === "boolean" ? body.isDefault : existing.isDefault,
        signalDefinitionId:
          body.signalDefinitionId === null ||
          (typeof body.signalDefinitionId === "string" && body.signalDefinitionId.trim())
            ? (body.signalDefinitionId as string | null)
            : existing.signalDefinitionId,
      },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await prismaBase.discoveryClassChip.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.isSystem || existing.slug === "all") {
    return NextResponse.json({ error: "system_chip_cannot_be_deleted" }, { status: 400 });
  }

  await prismaBase.discoveryClassChip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
