import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { createPublicBooking, BookingValidationError, BookingNotFoundError } from "@/server/services/booking/booking.service";
import { BookingStatus, PublicationType } from "@prisma/client";
import { getBusinessBookingDecisionAvailability } from "@/server/services/booking/bookingDecisionAvailability.service";
import { isSameSiteBrowserOrigin } from "@/lib/security/isSameSiteBrowserOrigin";
import { z } from "zod";

export const dynamic = "force-dynamic";
const replySchema = z.object({ action: z.enum(["ACCEPT", "DECLINE"]) }).strict();

async function authorizedInvitation(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.bookingReoffer.findFirst({
    where: { id, customerUserId: user.id },
    include: {
      originalBooking: {
        select: {
          id: true, businessId: true, userId: true, status: true,
          activityId: true, publicationType: true,
          customerName: true, customerPhone: true, customerEmail: true,
          customerComment: true, adultsCount: true, childrenCount: true,
          selectedSessionId: true, requestedDate: true, requestedTime: true,
          activity: { select: { title: true } },
        },
      },
    },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const invitation = await authorizedInvitation((await params).id);
  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const now = new Date();
  const status = invitation.status === "OFFERED" && invitation.expiresAt <= now
    ? "EXPIRED" : invitation.status;
  const availability = status === "OFFERED" && invitation.originalBooking.status === BookingStatus.REJECTED
    ? await getBusinessBookingDecisionAvailability(prisma, invitation.originalBookingId, invitation.businessId, now, { reoffer: true })
    : null;
  return NextResponse.json({
    id: invitation.id, status, expiresAt: invitation.expiresAt,
    publicationTitle: invitation.originalBooking.activity?.title ?? "Событие",
    requestedDate: invitation.originalBooking.requestedDate,
    requestedTime: invitation.originalBooking.requestedTime,
    canAccept: availability?.canConfirm === true,
    newBookingId: invitation.newBookingId,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSiteBrowserOrigin({ origin: request.headers.get("origin"), host: request.headers.get("host"),
    protocol: request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const id = (await params).id;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
  const invitation = await authorizedInvitation(id);
  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.action === "DECLINE") {
    const change = await prisma.bookingReoffer.updateMany({
      where: { id, customerUserId: user.id, status: "OFFERED", expiresAt: { gt: new Date() } },
      data: { status: "DECLINED", declinedAt: new Date() },
    });
    const latest = change.count === 1 ? null : await prisma.bookingReoffer.findFirst({
      where: { id, customerUserId: user.id }, select: { status: true, expiresAt: true, newBookingId: true },
    });
    return NextResponse.json({ status: change.count === 1 ? "DECLINED" :
      latest?.status === "OFFERED" && latest.expiresAt <= new Date() ? "EXPIRED" : latest?.status ?? "CANCELED",
      ...(latest?.newBookingId ? { bookingId: latest.newBookingId } : {}),
    });
  }
  if (invitation.status === "ACCEPTED" && invitation.newBookingId) {
    return NextResponse.json({ status: "ACCEPTED", bookingId: invitation.newBookingId });
  }
  if (invitation.status !== "OFFERED" || invitation.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Предложение больше не действует" }, { status: 409 });
  }
  const original = invitation.originalBooking;
  if (original.status !== BookingStatus.REJECTED || original.publicationType !== PublicationType.EVENT ||
      !original.activityId || original.userId !== user.id || !original.customerName || !original.customerPhone) {
    return NextResponse.json({ error: "Исходная заявка больше недоступна" }, { status: 409 });
  }
  try {
    // Existing EVENT command serializes on Activity and checks live seat limits.
    // Inside the *same* transaction it locks this invitation and marks ACCEPTED.
    const result = await createPublicBooking({
      reofferId: invitation.id, publicationType: PublicationType.EVENT,
      publicationId: original.activityId, userId: user.id,
      selectedSessionId: original.selectedSessionId,
      requestedDate: original.requestedDate, requestedTime: original.requestedTime,
      customerName: original.customerName, customerPhone: original.customerPhone,
      customerEmail: original.customerEmail, customerComment: original.customerComment,
      adultsCount: original.adultsCount, childrenCount: original.childrenCount,
    });
    return NextResponse.json({ status: "ACCEPTED", bookingId: result.bookingId });
  } catch (error) {
    // A double click may lose the invitation row race. It must get the original
    // newly created booking, not create another one.
    const latest = await prisma.bookingReoffer.findFirst({
      where: { id, customerUserId: user.id },
      select: { status: true, newBookingId: true },
    });
    if (latest?.status === "ACCEPTED" && latest.newBookingId) {
      return NextResponse.json({ status: "ACCEPTED", bookingId: latest.newBookingId });
    }
    if (error instanceof BookingValidationError || error instanceof BookingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[booking-reoffer] acceptance failed", { invitationId: id });
    return NextResponse.json({ error: "Запись не создана. Попробуйте ещё раз." }, { status: 500 });
  }
}
