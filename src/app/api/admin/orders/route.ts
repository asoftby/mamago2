import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { parsePaginationParams } from "@/lib/api/pagination";
import { getAdminOrders } from "@/server/services/booking/adminOrders.service";
import type { BookingSourceType } from "@/server/services/booking/booking.types";
import { BookingStatus, PublicationType } from "@prisma/client";

function parseBookingStatus(value: string | null): BookingStatus | undefined {
  if (!value) return undefined;
  return Object.values(BookingStatus).includes(value as BookingStatus)
    ? (value as BookingStatus)
    : undefined;
}

function parsePublicationType(value: string | null): PublicationType | undefined {
  if (!value) return undefined;
  return Object.values(PublicationType).includes(value as PublicationType)
    ? (value as PublicationType)
    : undefined;
}

function parseEntityType(value: string | null): BookingSourceType | undefined {
  if (!value) return undefined;
  return ["CAMP_SHIFT", "EVENT", "OFFER", "PLACE", "UNKNOWN"].includes(value)
    ? (value as BookingSourceType)
    : undefined;
}

function parseDateParam(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { page, limit } = parsePaginationParams(searchParams, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const result = await getAdminOrders({
      page,
      limit,
      status: parseBookingStatus(searchParams.get("status")),
      businessId: searchParams.get("businessId") || undefined,
      cityId: searchParams.get("cityId") || undefined,
      search: searchParams.get("search") || searchParams.get("q") || undefined,
      dateFrom: parseDateParam(searchParams.get("dateFrom")),
      dateTo: parseDateParam(searchParams.get("dateTo")),
      publicationType: parsePublicationType(searchParams.get("publicationType")),
      entityType: parseEntityType(
        searchParams.get("entityType") || searchParams.get("sourceType"),
      ),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin orders" },
      { status: 500 },
    );
  }
}
