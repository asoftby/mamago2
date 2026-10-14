import { NextRequest, NextResponse } from "next/server";
import { getPublicBirthdayCatalog } from "@/server/birthday/catalog.service";

export async function GET(request: NextRequest) {
  const city = new URL(request.url).searchParams.get("city");
  if (!city || !/^[a-z][a-z0-9-]{0,80}$/.test(city)) {
    return NextResponse.json({ error: "Некорректный город" }, { status: 400 });
  }
  try {
    const offers = await getPublicBirthdayCatalog(city);
    if (!offers) return NextResponse.json({ error: "Город не найден" }, { status: 404 });
    return NextResponse.json({ offers }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("[birthday/catalog]", error);
    return NextResponse.json({ error: "Каталог временно недоступен" }, { status: 500 });
  }
}
