import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { 
  const { id } = await params;
  const body = await req.json(); 
  const updated = await prisma.signalDefinition.update({ 
    where: { id }, 
    data: { 
      title: body.title, 
      order: body.order, 
      isActive: body.isActive, 
    }, 
  }); 
  return NextResponse.json(updated); 
} 

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { 
  const { id } = await params;
  await prisma.signalDefinition.delete({ where: { id } }); 
  return NextResponse.json({ ok: true }); 
} 
