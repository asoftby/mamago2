import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) { 
  const { id } = await params;
  const body = await req.json(); 
  const label = String(body.label || "").trim(); 
  const value = String(body.value || "").trim(); 
  if (!label || !value) return NextResponse.json({ ok:false, error:"label and value required" }, { status: 400 }); 

  const created = await prisma.filterOption.create({ 
    data: { filterId: id, label, value, order: body.order ?? 0, isActive: body.isActive ?? true }, 
  }); 
  return NextResponse.json(created); 
} 
