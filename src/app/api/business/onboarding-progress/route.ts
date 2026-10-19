import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { getPartnerCabinetBusiness } from "@/server/permissions/business-permissions";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

export const runtime = "nodejs";

type Action = "start" | "tour_complete" | "tour_skip" | "public_open";
const validActions = new Set<Action>(["start", "tour_complete", "tour_skip", "public_open"]);
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  // State-changing, cookie-authenticated endpoint: disallow cross-origin requests.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 415, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? body.action : undefined;
  if (typeof action !== "string" || !validActions.has(action as Action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: noStore });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });

  // Canonical partner membership; ownerUserId is not an authorization grant.
  const business = await getPartnerCabinetBusiness(user.id);
  if (!business || getEffectiveVerificationStatus(business) !== "APPROVED" || business.operationalStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }

  const now = new Date();
  const patch =
    action === "tour_complete" ? { tourCompletedAt: now } :
    action === "tour_skip" ? { tourSkippedAt: now } :
    action === "public_open" ? { firstPublicViewedAt: now } : {};

  await prisma.businessOnboardingState.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    create: {
      businessId: business.id,
      userId: user.id,
      ...(action === "start" ? { startedAt: now } : {}),
      tourVersion: 1,
      ...patch,
    },
    update: { ...(action === "start" ? { startedAt: now } : {}), ...patch },
  });

  return NextResponse.json({ ok: true }, { headers: noStore });
}
