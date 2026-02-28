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
    const { name } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    const district = await prisma.district.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(district);
  } catch (error: any) {
    console.error("Error updating district:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Такой район уже есть в этом городе" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update district" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.district.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting district:", error);
    return NextResponse.json({ error: "Failed to delete district" }, { status: 500 });
  }
}
