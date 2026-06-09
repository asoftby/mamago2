import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { listAdminCityRows } from "@/server/city/cityAdminData";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("details") === "1") {
      const cities = await listAdminCityRows();
      return NextResponse.json(cities);
    }

    const cities = await prisma.city.findMany({
      where: { isLegacyNonCity: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        region: { select: { name: true } },
        country: { select: { name: true } },
      },
    });
    return NextResponse.json(cities);
  } catch (error) {
    console.error("Error fetching cities:", error);
    return NextResponse.json({ error: "Failed to fetch cities" }, { status: 500 });
  }
}
