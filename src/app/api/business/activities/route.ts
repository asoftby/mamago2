import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { createActivity, listBusinessActivities } from "@/server/services/activity.service";
import { ActivityType, ScheduleMode } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import {
  nextResponseFromBusinessAccessError,
  requireBusinessPermission,
} from "@/server/permissions/business-permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    try {
      await requireBusinessPermission(user, business.id, "business.view");
    } catch (e) {
      const denied = nextResponseFromBusinessAccessError(e);
      if (denied) return denied;
      throw e;
    }

    const activities = await listBusinessActivities(business.id);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("List activities error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    try {
      await requireBusinessPermission(user, business.id, "content.create");
    } catch (e) {
      const denied = nextResponseFromBusinessAccessError(e);
      if (denied) return denied;
      throw e;
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
      scheduleMode = ScheduleMode.ONE_TIME
    } = body;

    // Use name as title if title is missing (backward compat)
    const finalTitle = title || body.name;

    if (!finalTitle || !cityId) {
      return NextResponse.json(
        { error: "title and cityId are required" },
        { status: 400 }
      );
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
      sessions: sessions ? sessions.map((s: string) => new Date(s)) : undefined,
      type,
      scheduleMode,
    });

    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
