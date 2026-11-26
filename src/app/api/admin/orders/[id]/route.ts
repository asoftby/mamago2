import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getAdminOrderById } from "@/server/services/booking/adminOrders.service";
import { getAdminAuditLogsForEntity } from "@/server/services/adminAuditLog.service";

/** Read-only admin order detail; never expose business contacts or Direct history publicly. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  try {
    const [order, auditLogs] = await Promise.all([
      getAdminOrderById(id),
      getAdminAuditLogsForEntity("BOOKING_REQUEST", id),
    ]);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ order, auditLogs }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[admin/orders/detail] failed", error);
    return NextResponse.json({ error: "Unable to load order" }, { status: 500 });
  }
}
