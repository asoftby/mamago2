import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessInbox } from "@/server/services/booking/businessInbox.service";
import type { BusinessInboxKind } from "@/server/services/booking/businessInbox.service";
import type { BookingBucket } from "@/server/services/booking/bookingBucket";

const validBuckets = new Set(["ACTION_REQUIRED", "UPCOMING", "AWAITING_CUSTOMER", "ARCHIVE"]);
const validKinds = new Set(["all", "standard", "party"]);

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 403 });
    const params = request.nextUrl.searchParams;
    const tabMap: Record<string, string> = {
      action: "ACTION_REQUIRED", upcoming: "UPCOMING",
      customer: "AWAITING_CUSTOMER", archive: "ARCHIVE",
    };
    const bucketValue = tabMap[params.get("tab") ?? "action"] ?? params.get("tab") ?? "ACTION_REQUIRED";
    const kindValue = params.get("kind") ?? "all";
    if (!validBuckets.has(bucketValue) || !validKinds.has(kindValue)) {
      return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
    }
    const limitValue = params.get("limit");
    const limit = limitValue === null ? 100 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    const result = await getBusinessInbox({
      businessId: business.id,
      bucket: bucketValue as BookingBucket,
      kind: kindValue as BusinessInboxKind,
      limit,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[business/bookings/inbox] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
