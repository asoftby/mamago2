import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cityId = searchParams.get("cityId");

  if (!cityId) {
    return NextResponse.json({ error: "City ID is required" }, { status: 400 });
  }

  try {
    const districts = await prisma.district.findMany({
      where: { cityId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });
    return NextResponse.json(districts);
  } catch (error) {
    console.error("Error fetching districts:", error);
    return NextResponse.json({ error: "Failed to fetch districts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cityId, name } = body;

    if (!cityId || !name) {
      return NextResponse.json({ error: "City ID and Name are required" }, { status: 400 });
    }
    
    if (name.trim().length < 2) {
       return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    const district = await prisma.district.create({
      data: {
        cityId,
        name: name.trim(),
      },
    });

    return NextResponse.json(district, { status: 201 });
  } catch (error: any) {
    console.error("Error creating district:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Такой район уже есть в этом городе" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create district" }, { status: 500 });
  }
}
