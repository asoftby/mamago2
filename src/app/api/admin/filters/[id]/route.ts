import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, slug, type, ui, order, isActive, placement, orderIndex } = body;

    const filter = await prisma.filterDefinition.update({
      where: { id },
      data: {
        title,
        slug,
        type,
        ui,
        order,
        isActive,
        placement,
        orderIndex,
      },
    });

    return NextResponse.json(filter);
  } catch (error) {
    return NextResponse.json({ error: "Error updating filter" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { 
  const { id } = await params;
  await prisma.filterDefinition.delete({ where: { id } }); 
  return NextResponse.json({ ok: true }); 
} 
