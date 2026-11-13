import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicationType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  createDirectThread,
  DirectThreadError,
} from "@/server/services/direct/directThread.service";
import { notifyDirectCreated, notifyDirectMessage } from "@/server/services/notification.service";
import {
  BookingDirectError,
  openCustomerDirectThreadForBooking,
} from "@/server/services/direct/directBookingThread.service";
import prisma from "@/lib/prisma";
import { DirectSendLimitError } from "@/server/services/direct/directRiskSignal.service";
import { DirectMessageError } from "@/server/services/direct/directMessage.service";
import { getTrustedClientIp } from "@/lib/security/clientIp";

const createThreadSchema = z
  .object({
    /** Customer writes to the organizer about their own booking request ("Мои записи"). */
    bookingRequestId: z.string().min(1).max(64).optional(),
    publicationType: z.nativeEnum(PublicationType).optional(),
    offerId: z.string().optional(),
    activityId: z.string().optional(),
    placeId: z.string().optional(),
    comment: z.string().min(1, "Опишите ваш вопрос").max(2000),
    date: z.string().max(60).optional(),
    childAge: z.string().max(20).optional(),
    guestsCount: z.string().max(10).optional(),
  })
  .refine((v) => v.bookingRequestId || (v.publicationType && (v.offerId || v.activityId || v.placeId)), {
    message: "publicationType reference is required",
  });

/** Folds the MVP form fields into the single immutable message body. */
function composeInitialMessage(input: z.infer<typeof createThreadSchema>): string {
  const extra: string[] = [];
  if (input.date) extra.push(`Дата: ${input.date}`);
  if (input.childAge) extra.push(`Возраст ребёнка: ${input.childAge}`);
  if (input.guestsCount) extra.push(`Количество гостей: ${input.guestsCount}`);

  if (extra.length === 0) return input.comment.trim();
  return `${input.comment.trim()}\n\n${extra.map((line) => `— ${line}`).join("\n")}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    const ip = getTrustedClientIp(request) ?? "unknown";
    const rateLimit = await checkRateLimit(`direct_create:${user.id}:${ip}`, 10, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const data = createThreadSchema.parse(body);

    if (data.bookingRequestId) {
      const result = await openCustomerDirectThreadForBooking({
        bookingRequestId: data.bookingRequestId,
        customerUserId: user.id,
        message: composeInitialMessage(data),
      });
      const target = await prisma.directThread.findUnique({
        where: { id: result.threadId },
        select: { business: { select: { ownerUserId: true } } },
      });
      if (target) {
        const notify = result.created
          ? notifyDirectCreated({
              ownerUserId: target.business.ownerUserId,
              threadId: result.threadId,
              threadNumber: result.threadNumber,
            })
          : result.appendedMessageId
            ? notifyDirectMessage({
                recipientUserId: target.business.ownerUserId,
                recipientSurface: "BUSINESS",
                threadId: result.threadId,
                threadNumber: result.threadNumber,
                messageId: result.appendedMessageId,
              })
            : Promise.resolve(null);
        notify.catch((e) => console.error("[direct] booking notify failed:", e));
      }
      return NextResponse.json(
        { threadId: result.threadId, threadNumber: result.threadNumber },
        { status: result.created ? 201 : 200 },
      );
    }

    if (!data.publicationType) {
      return NextResponse.json({ error: "publicationType is required" }, { status: 400 });
    }
    const thread = await createDirectThread({
      customerUserId: user.id,
      publicationType: data.publicationType,
      offerId: data.offerId ?? null,
      activityId: data.activityId ?? null,
      placeId: data.placeId ?? null,
      initialMessage: composeInitialMessage(data),
    });

    notifyDirectCreated({
      ownerUserId: thread.business.ownerUserId,
      threadId: thread.id,
      threadNumber: thread.threadNumber,
    }).catch((e) => console.error("[direct] notifyDirectCreated failed:", e));

    return NextResponse.json(
      { threadId: thread.id, threadNumber: thread.threadNumber },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof BookingDirectError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error instanceof DirectSendLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.kind === "FLOOD_LOCK" ? 429 : 403 });
    }
    if (error instanceof DirectMessageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof DirectThreadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[direct] create thread error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
