/**
 * POST /api/business/bookings/[id]/phone-click
 *
 * Записывает событие "телефон открыт" в историю заявки.
 * Вызывается клиентом при клике на кнопку "Позвонить".
 * Обновляет lastActivityAt.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { recordPhoneClicked } from "@/server/services/booking/bookingActivity.service";

export async function POST(
  _request: NextRequest,
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

    // Verify ownership
    const booking = await prisma.bookingRequest.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.businessId !== business.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fire-and-forget — response is immediate
    recordPhoneClicked(id, user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/business/bookings/[id]/phone-click]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
