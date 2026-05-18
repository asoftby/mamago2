import { NextRequest, NextResponse } from "next/server";
import { prismaBase } from "@/lib/prisma";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const chips = await listDiscoveryClassChips({ includeInactive: true });
  return NextResponse.json(chips);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  const slug = String(body.slug ?? "").trim().toLowerCase();

  if (!title || !slug) {
    return NextResponse.json({ error: "title and slug are required" }, { status: 400 });
  }

  const created = await prismaBase.discoveryClassChip.create({
    data: {
      title,
      slug,
      description: typeof body.description === "string" ? body.description : null,
      icon: typeof body.icon === "string" ? body.icon : null,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      isActive: body.isActive !== false,
      isDefault: body.isDefault === true,
      isSystem: false,
      entityType: "OFFER",
      surfaceKey: "CLASSES",
      signalDefinitionId:
        typeof body.signalDefinitionId === "string" && body.signalDefinitionId.trim()
          ? body.signalDefinitionId
          : null,
    },
  });

  return NextResponse.json(created);
}
