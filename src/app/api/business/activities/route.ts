import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { createActivity, listBusinessActivities } from "@/server/services/activity.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
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
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, cityId, coverImageUrl, priceFrom, currency, ageLabel, sessions } =
      body;

    if (!name || !cityId) {
      return NextResponse.json(
        { error: "name and cityId are required" },
        { status: 400 }
      );
    }

    const activity = await createActivity({
      name,
      description,
      cityId,
      coverImageUrl,
      priceFrom,
      currency,
      ageLabel,
      businessId: business.id,
      createdBy: user.id,
      sessions: sessions ? sessions.map((s: string) => new Date(s)) : undefined,
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
