import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { parseContentImportContactsHint } from "@/lib/content-editor/importContactsHint";

export const runtime = "nodejs";

function extractPhones(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const o = raw as Record<string, unknown>;
  const directPhones = Array.isArray(o.phones)
    ? o.phones.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const singlePhone =
    typeof o.phone === "string" && o.phone.trim().length > 0 ? [o.phone.trim()] : [];
  return [...new Set([...singlePhone, ...directPhones.map((p) => p.trim())])];
}

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

  const normalizedHint = parseContentImportContactsHint(linkedImport?.normalizedData);
  const rawHint = parseContentImportContactsHint(linkedImport?.rawPayload);
  const hint = normalizedHint ?? rawHint;
  const phones = [
    ...new Set([
      ...(hint?.phone ? [hint.phone] : []),
      ...extractPhones(linkedImport?.normalizedData),
      ...extractPhones(linkedImport?.rawPayload),
    ]),
  ];

  return NextResponse.json({
    phone: hint?.phone ?? "",
    phones,
    website: hint?.website ?? "",
    socialUrls: hint?.socialUrls ?? [],
  });
}
