import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { BookingStatus, PublicationType } from "@prisma/client";

interface WeekDayCount {
  date: string;
  total: number;
  newCount: number;
  confirmedCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const weekStartParam = searchParams.get("weekStart");
    const statusParam = searchParams.get("status");
    const publicationTypeParam = searchParams.get("publicationType");

    // Build where clause
    const where: any = {
      businessId: business.id,
    };

    if (dateParam) {
      const date = new Date(dateParam);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.OR = [
        {
          requestedDate: {
            gte: date,
            lt: nextDay,
          },
        },
        {
          session: {
            startsAt: {
              gte: date,
              lt: nextDay,
            },
          },
        },
      ];
    }

    if (statusParam && Object.values(BookingStatus).includes(statusParam as BookingStatus)) {
      where.status = statusParam as BookingStatus;
    }

    if (publicationTypeParam && Object.values(PublicationType).includes(publicationTypeParam as PublicationType)) {
      where.publicationType = publicationTypeParam as PublicationType;
    }

    const bookings = await prisma.bookingRequest.findMany({
      where,
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        offer: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        place: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        session: {
          select: {
            id: true,
            startsAt: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { requestedDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Calculate week counts if weekStart is provided
    let weekCounts: WeekDayCount[] | undefined;
    
    if (weekStartParam) {
      const weekStart = new Date(weekStartParam);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Fetch all bookings for the week
      const weekBookings = await prisma.bookingRequest.findMany({
        where: {
          businessId: business.id,
          OR: [
            {
              requestedDate: {
                gte: weekStart,
                lt: weekEnd,
              },
            },
            {
              session: {
                startsAt: {
                  gte: weekStart,
                  lt: weekEnd,
                },
              },
            },
          ],
        },
        include: {
          session: {
            select: {
              startsAt: true,
            },
          },
        },
      });

      // Group by date
      weekCounts = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split("T")[0];
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayBookings = weekBookings.filter((b) => {
          const bookingDate = b.session?.startsAt || b.requestedDate;
          if (!bookingDate) return false;
          const bDate = new Date(bookingDate);
          return bDate >= currentDate && bDate < nextDate;
        });

        weekCounts.push({
          date: dateStr,
          total: dayBookings.length,
          newCount: dayBookings.filter((b) => b.status === BookingStatus.NEW).length,
          confirmedCount: dayBookings.filter((b) => b.status === BookingStatus.CONFIRMED).length,
        });
      }
    }

    const response: any = {
      items: bookings,
    };

    if (weekCounts) {
      response.weekCounts = weekCounts;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
