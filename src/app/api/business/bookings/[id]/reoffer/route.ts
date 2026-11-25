import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessBookingDecisionAvailability } from "@/server/services/booking/bookingDecisionAvailability.service";
import { createNotification } from "@/server/services/notification.service";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { BookingKind, BookingStatus, PublicationType } from "@prisma/client";

export const dynamic = "force-dynamic";

async function context(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const business = await getMyBusiness(user.id);
  if (!business) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const original = await prisma.bookingRequest.findFirst({
    where: { id, businessId: business.id, kind: BookingKind.STANDARD },
    select: {
      id: true, userId: true, businessId: true, status: true, publicationType: true,
      activityId: true, requestedDate: true, requestedTime: true,
      session: { select: { startsAt: true } },
    },
  });
  if (!original) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { user, business, original };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await context(id);
  if (result.error) return result.error;
  const { original, business } = result;
  if (!original || !business) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invitation = await prisma.bookingReoffer.findUnique({
    where: { originalBookingId: id },
    select: { id: true, status: true, expiresAt: true, createdAt: true },
  });
  const possible = original.status === BookingStatus.REJECTED && Boolean(original.userId) &&
    original.publicationType === PublicationType.EVENT;
  const capacity = possible
    ? await getBusinessBookingDecisionAvailability(prisma, id, business.id, new Date(), { reoffer: true })
    : null;
  return NextResponse.json({
    eligible: possible && !invitation && capacity?.code === "AVAILABLE" && capacity.canConfirm,
    reason: original.userId ? capacity?.message ?? null : "Для гостя пока доступна связь по телефону",
    remaining: capacity?.remaining ?? null,
    invitation: invitation && { ...invitation, status: invitation.status === "OFFERED" && invitation.expiresAt <= new Date() ? "EXPIRED" : invitation.status },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await context(id);
  if (result.error) return result.error;
  const { original, business, user } = result;
  if (!original || !business || !user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (original.status !== BookingStatus.REJECTED || !original.userId ||
      original.publicationType !== PublicationType.EVENT || !original.activityId) {
    return NextResponse.json({ error: "Для этой заявки повторное предложение недоступно" }, { status: 422 });
  }
  const throttle = await checkRateLimit(`reoffer_send:${business.id}:${user.id}`, 20, 24 * 60 * 60 * 1000);
  if (!throttle.allowed) return NextResponse.json({ error: "Too many invitations" }, { status: 429 });
  const now = new Date();
  const decision = await getBusinessBookingDecisionAvailability(prisma, id, business.id, now, { reoffer: true });
  if (decision?.code !== "AVAILABLE" || !decision.canConfirm) {
    return NextResponse.json({ error: decision?.message ?? "Свободных мест нет" }, { status: 409 });
  }
  const endOfDate = original.requestedDate
    ? new Date(original.requestedDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : null;
  const deadline = original.session?.startsAt ?? endOfDate;
  const expiresAt = new Date(Math.min(now.getTime() + 24 * 60 * 60 * 1000, deadline?.getTime() ?? 0));
  if (expiresAt.getTime() <= now.getTime() + 60_000) {
    return NextResponse.json({ error: "До начала события недостаточно времени" }, { status: 409 });
  }
  try {
    const invitation = await prisma.bookingReoffer.create({
      data: {
        originalBookingId: id, businessId: business.id, customerUserId: original.userId,
        activityId: original.activityId, invitedById: user.id, expiresAt,
      },
      select: { id: true, status: true, expiresAt: true },
    });
    // The notification contains only a public context and an opaque invitation ID.
    // Delivery is not asserted; channel failures are handled by the existing delivery log.
    try {
      await createNotification({
        userId: original.userId, audience: "USER", type: "SYSTEM",
        title: "Освободилось место", body: "Организатор предлагает вам повторно записаться. Подтвердите, если ещё хотите посетить событие.",
        ctaLabel: "Ответить", ctaAction: `/booking-reoffers/${invitation.id}`,
      });
    } catch (error) {
      console.error("[booking-reoffer] notification dispatch failed", error);
    }
    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Предложение по этой заявке уже существует" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await context(id);
  if (result.error) return result.error;
  const count = await prisma.bookingReoffer.updateMany({
    where: { originalBookingId: id, status: "OFFERED", businessId: result.business!.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  return NextResponse.json({ canceled: count.count === 1 });
}
