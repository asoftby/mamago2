import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { z } from "zod";
import { BookingStatus } from "@prisma/client";
import {
  updateBookingStatus,
  getBusinessBookingById,
  BookingOwnershipError,
  BookingStatusTransitionError,
} from "@/server/services/booking/bookingQuery.service";
import { attachDirectAvailabilityToBusinessBookings } from "@/server/services/direct/directBookingThread.service";
import { BookingHoldExpiredError } from "@/server/services/booking/bookingHold";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  businessBookingDetailProjection,
  businessBookingDetailRevealsContact,
  businessBookingListProjection,
} from "@/server/services/booking/businessBookingContactProjection";

const updateBookingSchema = z.object({
  status: z.enum([
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.COMPLETED,
  ]),
});

/** Tenant-scoped single STANDARD detail: no 200-row calendar cap. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const business = await getMyBusiness(user.id);
  if (!business) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const item = await getBusinessBookingById(id, business.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await attachDirectAvailabilityToBusinessBookings([item]);
  const detail = businessBookingDetailProjection(item);
  if (businessBookingDetailRevealsContact(detail)) {
    // A selected order is not an export endpoint. Bound large automated reads
    // by an authenticated staff member to deter collection of customer lists.
    const limit = await checkRateLimit(`business_contact_detail:${business.id}:${user.id}`, 120, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many customer detail requests" }, { status: 429 });
    }
    // Fail closed: never return contact data without a durable disclosure log.
    await logAdminAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "BUSINESS_BOOKING_CONTACT_VIEWED",
      entityType: "BOOKING_REQUEST",
      entityId: id,
      metadata: { businessId: business.id, surface: "business_booking_detail" },
    });
  }
  return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const body = await request.json();
    const data = updateBookingSchema.parse(body);
    const { id } = await params;

    const updatedBooking = await updateBookingStatus(id, business.id, data.status, {
      actorId: user.id,
      actorRole: user.role,
      metadata: {
        source: "business_legacy_patch_route",
      },
    });

    await attachDirectAvailabilityToBusinessBookings([updatedBooking]);
    // Status-changing responses must not quietly repopulate the bulk list with PII.
    return NextResponse.json(businessBookingListProjection(updatedBooking));

  } catch (error) {
    if (error instanceof BookingOwnershipError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof BookingHoldExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BookingStatusTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error)?.message === "Заявка не найдена") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    console.error("Update booking error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
