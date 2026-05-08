/**
 * ПРИМЕР: API endpoint для бронирований с phone verification gate
 * 
 * Расположение: src/app/api/bookings/route.ts
 * 
 * Этот файл является примером и не используется в production.
 * Скопируйте код в реальный endpoint когда будете реализовывать бронирования.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePhoneVerifiedUser } from "@/lib/auth/requirePhoneVerifiedUser";
import { BookingStatus } from "@prisma/client";

/**
 * POST /api/bookings
 * Создание заявки на бронирование
 * 
 * Требования:
 * - Авторизация
 * - Подтвержденный телефон (verification gate для UGC)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("[create-booking] Starting...");
    
    // Verification gate: проверка авторизации и подтверждения телефона
    const userOrError = await requirePhoneVerifiedUser();
    if (userOrError instanceof NextResponse) {
      console.error("[create-booking] Verification gate failed");
      return userOrError;
    }
    const user = userOrError;

    console.log("[create-booking] User verified:", {
      id: user.id,
      email: user.email,
      phoneVerified: !!user.phoneVerifiedAt,
      phone: user.phoneE164,
    });

    // Получить данные из запроса
    const body = await request.json();
    const {
      activityId,
      requestedDate,
      requestedTime,
      adultsCount,
      childrenCount,
      customerComment,
    } = body;

    // Валидация
    if (!activityId || typeof activityId !== "string") {
      return NextResponse.json(
        { error: "INVALID_ACTIVITY_ID", message: "Activity ID is required" },
        { status: 400 }
      );
    }

    if (!requestedDate || typeof requestedDate !== "string") {
      return NextResponse.json(
        { error: "INVALID_DATE", message: "Date is required" },
        { status: 400 }
      );
    }

    const totalParticipants = (adultsCount || 1) + (childrenCount || 0);
    if (totalParticipants < 1) {
      return NextResponse.json(
        { error: "INVALID_PARTICIPANTS", message: "Number of participants must be at least 1" },
        { status: 400 }
      );
    }

    // Получить активность
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        priceFrom: true,
        businessId: true,
        business: {
          select: {
            id: true,
          },
        },
        place: {
          select: {
            id: true,
            title: true,
            phone: true,
          },
        },
      },
    });

    if (!activity) {
      return NextResponse.json(
        { error: "ACTIVITY_NOT_FOUND", message: "Activity not found" },
        { status: 404 }
      );
    }

    if (!activity.businessId) {
      return NextResponse.json(
        { error: "NO_BUSINESS", message: "Activity has no associated business" },
        { status: 400 }
      );
    }

    // Можно бронировать только опубликованные активности
    if (activity.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "ACTIVITY_NOT_PUBLISHED", message: "Cannot book unpublished activity" },
        { status: 400 }
      );
    }

    // Проверить что дата в будущем
    const bookingDate = new Date(requestedDate);
    if (bookingDate < new Date()) {
      return NextResponse.json(
        { error: "INVALID_DATE", message: "Booking date must be in the future" },
        { status: 400 }
      );
    }

    // Создать бронирование
    const booking = await prisma.bookingRequest.create({
      data: {
        businessId: activity.businessId,
        userId: user.id,
        publicationType: "EVENT", // Activity = EVENT в контексте бронирований
        activityId: activityId,
        placeId: activity.place?.id,
        requestedDate: bookingDate,
        requestedTime: requestedTime || null,
        adultsCount: adultsCount || 1,
        childrenCount: childrenCount || 0,
        customerName: user.displayName || user.email,
        customerEmail: user.email,
        customerPhone: user.phoneE164!, // Гарантированно есть после requirePhoneVerifiedUser
        customerComment: customerComment || null,
        status: "NEW", // Новая заявка
      },
    });

    console.log("[create-booking] ✅ Booking created:", {
      id: booking.id,
      activityId: booking.activityId,
      userId: booking.userId,
      requestedDate: booking.requestedDate,
      status: booking.status,
    });

    // Отправить уведомление бизнесу (если есть email/phone)
    // TODO: Implement notification logic

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        status: booking.status,
        message: "Заявка отправлена! Организатор свяжется с вами в ближайшее время.",
        estimatedResponseTime: "24 часа",
      },
    });
  } catch (error) {
    console.error("[create-booking] ❌ Error:", error);
    console.error("[create-booking] Error stack:", error instanceof Error ? error.stack : "No stack");
    
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bookings
 * Получение списка бронирований пользователя
 * 
 * Требует авторизации, но не требует phone verification (только чтение)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Только проверка авторизации (без phone verification для чтения)
    const { getCurrentUser } = await import("@/lib/auth/server");
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please log in to view bookings" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Получить бронирования пользователя
    const bookings = await prisma.bookingRequest.findMany({
      where: {
        userId: user.id,
        ...(status && { status: status as BookingStatus }),
      },
      select: {
        id: true,
        requestedDate: true,
        requestedTime: true,
        adultsCount: true,
        childrenCount: true,
        status: true,
        createdAt: true,
        activity: {
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            type: true,
          },
        },
        place: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.bookingRequest.count({
      where: {
        userId: user.id,
        ...(status && { status: status as BookingStatus }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        bookings,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[get-bookings] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
