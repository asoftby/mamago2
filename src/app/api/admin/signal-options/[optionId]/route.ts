import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageSignalDefinitions } from "@/lib/auth/signalDefinitionsAdmin";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { optionId } = await params;
  const body = await req.json(); 
  const updated = await prisma.signalOption.update({ 
    where: { id: optionId }, 
    data: { label: body.label, value: body.value, order: body.order, isActive: body.isActive }, 
  }); 
  return NextResponse.json(updated); 
} 

export async function DELETE(_: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageSignalDefinitions(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { optionId } = await params;
  await prisma.signalOption.delete({ where: { id: optionId } }); 
  return NextResponse.json({ ok: true }); 
} 
