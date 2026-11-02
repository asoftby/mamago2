import { NextResponse } from "next/server";
import { revalidateEventStep1Signals } from "@/server/admin/activities/revalidateEventStep1Signals";
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
  const previous = await prisma.signalOption.findUnique({
    where: { id: optionId },
    select: { definition: { select: { slug: true } } },
  });
  const body = await req.json(); 
  const updated = await prisma.signalOption.update({ 
    where: { id: optionId }, 
    data: { label: body.label, value: body.value, order: body.order, isActive: body.isActive }, 
  }); 
  revalidateEventStep1Signals(previous?.definition.slug);
  return NextResponse.json(updated); 
} 

export async function DELETE(_: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageSignalDefinitions(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { optionId } = await params;
  const previous = await prisma.signalOption.findUnique({
    where: { id: optionId },
    select: { definition: { select: { slug: true } } },
  });
  await prisma.signalOption.delete({ where: { id: optionId } });
  revalidateEventStep1Signals(previous?.definition.slug);
  return NextResponse.json({ ok: true });
}
