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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BookingStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import {
  updateBookingStatus,
  BookingStatusTransitionError,
  BookingOwnershipError,
} from "@/server/services/booking/bookingQuery.service";

const bodySchema = z.object({
  status: z.enum([
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.COMPLETED,
  ]),
});

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

    const updated = await updateBookingStatus(id, business.id, parsed.data.status);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof BookingOwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
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
