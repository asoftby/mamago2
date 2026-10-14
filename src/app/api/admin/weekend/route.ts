import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { getAdminWeekendData } from "@/server/services/weekendPlanner.service";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;
  const city = request.nextUrl.searchParams.get("city") ?? "minsk";
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^[a-z0-9-]{2,60}$/.test(city)) return NextResponse.json({ error: "invalid_city" }, { status: 400 });
  const data = await getAdminWeekendData(auth.id, city, date);
  if (!data) return NextResponse.json({ error: "invalid_date_or_city" }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
