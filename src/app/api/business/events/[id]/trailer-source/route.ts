import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { parseEventImportTrailerHint } from "@/lib/content-editor/importTrailerHint";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id: activityId } = await params;
  if (!(await canManageActivityById(user, activityId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, type: ActivityType.EVENT },
    select: { id: true },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const linkedImport = await prisma.importedRecord.findFirst({
    where: { publishedActivityId: activityId },
    orderBy: { updatedAt: "desc" },
    select: { normalizedData: true, rawPayload: true },
  });

  const normalizedHint = parseEventImportTrailerHint(linkedImport?.normalizedData);
  const rawHint = parseEventImportTrailerHint(linkedImport?.rawPayload);
  return NextResponse.json({ trailer: normalizedHint ?? rawHint });
}
