import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { optionId } = await params;
  const body = await req.json(); 
  const updated = await prisma.filterOption.update({ 
    where: { id: optionId }, 
    data: { label: body.label, value: body.value, order: body.order, isActive: body.isActive }, 
  }); 
  return NextResponse.json(updated); 
} 

export async function DELETE(_: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const { optionId } = await params;
  await prisma.filterOption.delete({ where: { id: optionId } }); 
  return NextResponse.json({ ok: true }); 
} 
