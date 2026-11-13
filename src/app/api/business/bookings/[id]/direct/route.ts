import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  BookingDirectError,
  openBusinessDirectThreadForBooking,
} from "@/server/services/direct/directBookingThread.service";
import { notifyDirectMessage } from "@/server/services/notification.service";

const bodySchema = z.object({
  message: z.string().trim().min(1, "Введите сообщение").max(2000),
});

/**
 * Business → customer: opens (or returns the existing) Direct thread for a
 * booking request, with the first message from the business. Idempotent per
 * booking; guests (no account) have no chat.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const rateLimit = await checkRateLimit(`direct_booking_open:${user.id}`, 20, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { id } = await params;
    const data = bodySchema.parse(await request.json());
    const result = await openBusinessDirectThreadForBooking({
      bookingRequestId: id,
      actorUserId: user.id,
      message: data.message,
    });

    if (result.created && result.firstMessageId) {
      void notifyDirectMessage({
        recipientUserId: result.customerUserId,
        recipientSurface: "USER",
        threadId: result.threadId,
        threadNumber: result.threadNumber,
        messageId: result.firstMessageId,
        organizerReplyToBooking: true,
      }).catch((e) => console.error("[direct] notify customer (booking reply) failed:", e));
    }

    return NextResponse.json(
      { threadId: result.threadId, threadNumber: result.threadNumber, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof BookingDirectError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error("[direct] open booking thread error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
