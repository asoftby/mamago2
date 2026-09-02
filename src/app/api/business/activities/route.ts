import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { createActivity, listBusinessActivities } from "@/server/services/activity.service";
import { ActivityType, ScheduleMode } from "@prisma/client";
import {
  nextResponseFromBusinessAccessError,
  requireBusinessPermission,
} from "@/server/permissions/business-permissions";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    try {
      await requireBusinessPermission(user, business.id, "business.view");
    } catch (error) {
      const denied = nextResponseFromBusinessAccessError(error);
      if (denied) return denied;
      throw error;
    }

    return NextResponse.json({ activities: await listBusinessActivities(business.id) });
  } catch (error) {
    console.error("List activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    try {
      await requireBusinessPermission(user, business.id, "content.create");
    } catch (error) {
      const denied = nextResponseFromBusinessAccessError(error);
      if (denied) return denied;
      throw error;
    }

    const body = await request.json();
    const {
      title,
      shortDesc,
      description,
      cityId,
      coverImageUrl,
      priceFrom,
      currency,
      ageLabel,
      sessions,
      type = ActivityType.EVENT,
      scheduleMode = ScheduleMode.ONE_TIME,
    } = body;

    const finalTitle = title || body.name;
    if (!finalTitle || !cityId) {
      return NextResponse.json({ error: "title and cityId are required" }, { status: 400 });
    }

    const activity = await createActivity({
      title: finalTitle,
      shortDesc: shortDesc || description || "",
      description,
      cityId,
      coverImageUrl,
      priceFrom,
      currency,
      ageLabel,
      businessId: business.id,
      createdBy: user.id,
      sessions: sessions ? sessions.map((session: string) => new Date(session)) : undefined,
      type,
      scheduleMode,
    });

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
