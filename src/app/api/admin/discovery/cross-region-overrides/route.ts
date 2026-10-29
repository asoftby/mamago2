import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const activityId = new URL(request.url).searchParams.get("activityId");
  if (!activityId) {
    const regions = await prisma.region.findMany({ where: { type: "OBLAST", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ regions });
  }
  const rows = await prisma.crossRegionEditorialOverride.findMany({
    where: { activityId },
    orderBy: { expiresAt: "desc" },
  });
  return NextResponse.json(rows);
}

export async function PUT(request: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { activityId, regionId, reason, expiresAt } = body as Record<string, unknown>;
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : new Date(NaN);
  if (typeof activityId !== "string" || !activityId.trim() || typeof regionId !== "string" || !regionId.trim() ||
      typeof reason !== "string" || reason.trim().length < 5 || reason.length > 1000 ||
      !Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Invalid override" }, { status: 400 });
  }
  const [activity, region] = await Promise.all([
    prisma.activity.findUnique({ where: { id: activityId }, select: { id: true } }),
    prisma.region.findUnique({ where: { id: regionId }, select: { id: true, type: true } }),
  ]);
  if (!activity || !region || region.type !== "OBLAST") return NextResponse.json({ error: "Activity or oblast not found" }, { status: 404 });
  const row = await prisma.crossRegionEditorialOverride.upsert({
    where: { activityId_regionId: { activityId, regionId } },
    create: { activityId, regionId, reason: reason.trim(), expiresAt: expiry, createdById: auth.id },
    update: { reason: reason.trim(), expiresAt: expiry, createdById: auth.id },
  });
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");
  const regionId = searchParams.get("regionId");
  if (!activityId || !regionId) return NextResponse.json({ error: "activityId and regionId required" }, { status: 400 });
  await prisma.crossRegionEditorialOverride.deleteMany({ where: { activityId, regionId } });
  return NextResponse.json({ ok: true });
}
