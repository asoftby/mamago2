import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageSignalDefinitions } from "@/lib/auth/signalDefinitionsAdmin";

export const runtime = "nodejs";

async function resolveDefinitionId(identifier: string): Promise<string | null> {
  const bySlug = await prisma.signalDefinition.findUnique({
    where: { slug: identifier },
    select: { id: true },
  });
  if (bySlug) return bySlug.id;
  const byId = await prisma.signalDefinition.findUnique({
    where: { id: identifier },
    select: { id: true },
  });
  return byId?.id ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageSignalDefinitions(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const definitionId = await resolveDefinitionId(id);
  if (!definitionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json(); 
  const label = String(body.label || "").trim(); 
  const value = String(body.value || "").trim(); 
  if (!label || !value) return NextResponse.json({ ok:false, error:"label and value required" }, { status: 400 }); 

  const created = await prisma.signalOption.create({ 
    data: { definitionId, label, value, order: body.order ?? 0, isActive: body.isActive ?? true }, 
  }); 
  return NextResponse.json(created); 
} 
