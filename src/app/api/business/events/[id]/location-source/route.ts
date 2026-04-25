import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { parseEventImportLocationHint } from "@/lib/content-editor/eventImportLocationHint";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: activityId } = await params;
  if (!(await canManageActivityById(user, activityId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, type: ActivityType.EVENT },
    select: { id: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const linkedImport = await prisma.importedRecord.findFirst({
    where: { publishedActivityId: activityId },
    orderBy: { updatedAt: "desc" },
    select: {
      normalizedData: true,
      rawPayload: true,
    },
  });

  const normalizedHint = parseEventImportLocationHint(linkedImport?.normalizedData);
  const rawHint = parseEventImportLocationHint(linkedImport?.rawPayload);
  const hint = normalizedHint ?? rawHint;

  return NextResponse.json({
    venueName: hint?.venueName ?? "",
    addressText: hint?.addressText ?? "",
    cityName: hint?.cityName ?? "",
  });
}
