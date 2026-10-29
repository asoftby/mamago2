import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;
  const regions = await prisma.region.findMany({
    where: { type: "OBLAST" },
    select: { id: true, name: true, crossRegionFamilyThreshold: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(regions);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { regionId, threshold } = body as Record<string, unknown>;
  if (typeof regionId !== "string" || !regionId.trim() || !(threshold === null || (typeof threshold === "number" && Number.isInteger(threshold) && threshold >= 1 && threshold <= 1000000))) {
    return NextResponse.json({ error: "Invalid regionId or threshold" }, { status: 400 });
  }
  const updated = await prisma.region.updateMany({
    where: { id: regionId, type: "OBLAST" },
    data: { crossRegionFamilyThreshold: threshold as number | null },
  });
  if (!updated.count) return NextResponse.json({ error: "Region not found" }, { status: 404 });
  return NextResponse.json({ regionId, threshold });
}
