import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, lat, lng } = body;

    const updateData: {
      name?: string;
      lat?: number;
      lng?: number;
    } = {};
    if (name) updateData.name = name.trim();
    if (lat !== undefined) updateData.lat = Number(lat);
    if (lng !== undefined) updateData.lng = Number(lng);

    const station = await prisma.metroStation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(station);
  } catch (error: unknown) {
    console.error("Error updating metro station:", error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json({ error: "Такая станция уже существует" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update metro station" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.metroStation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting metro station:", error);
    return NextResponse.json({ error: "Failed to delete metro station" }, { status: 500 });
  }
}
