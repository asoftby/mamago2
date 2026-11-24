/**
 * PATCH /api/business/bookings/[id]/status
 *
 * Обновляет статус заявки.
 * Допустимые переходы:
 *   NEW → CONFIRMED | REJECTED
 *   CONFIRMED → COMPLETED | REJECTED
 *
 * Body: { status: "CONFIRMED" | "REJECTED" | "COMPLETED" }
 */

import { attachDirectAvailabilityToBusinessBookings } from "@/server/services/direct/directBookingThread.service";
import { NextRequest, NextResponse } from "next/server";
import { businessBookingDecisionSchema } from "@/lib/booking/businessBookingDecisionSchema";
import { BookingStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import {
  updateBookingStatus,
  BookingStatusTransitionError,
  BookingOwnershipError,
  BookingDecisionCapacityError,
} from "@/server/services/booking/bookingQuery.service";
import { BookingHoldExpiredError } from "@/server/services/booking/bookingHold";
import { businessBookingListProjection } from "@/server/services/booking/businessBookingContactProjection";

const bodySchema = businessBookingDecisionSchema;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await updateBookingStatus(id, business.id, parsed.data.status, {
      actorId: user.id,
      actorRole: user.role,
      reason: parsed.data.reason ?? null,
      metadata: {
        source: "business_status_endpoint",
      },
    });
    await attachDirectAvailabilityToBusinessBookings([updated]);
    return NextResponse.json(businessBookingListProjection(updated));
  } catch (err) {
    if (err instanceof BookingOwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof BookingDecisionCapacityError) {
      return NextResponse.json({ error: err.message, code: "EVENT_CAPACITY_CHANGED" }, { status: 409 });
    }
    if (err instanceof BookingHoldExpiredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof BookingStatusTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if ((err as Error)?.message === "Заявка не найдена") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    console.error("[PATCH /api/business/bookings/[id]/status]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
