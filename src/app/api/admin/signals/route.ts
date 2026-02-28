import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() { 
  const items = await prisma.signalDefinition.findMany({ 
    orderBy: [{ order: "asc" }, { slug: "asc" }], 
    include: { options: { orderBy: [{ order: "asc" }, { value: "asc" }] } }, 
  }); 
  return NextResponse.json(items); 
} 

export async function POST(req: Request) { 
  const body = await req.json(); 
  const slug = String(body.slug || "").trim(); 
  const title = String(body.title || "").trim(); 
  if (!slug || !title) return NextResponse.json({ ok:false, error:"slug and title required" }, { status: 400 }); 

  const created = await prisma.signalDefinition.create({ 
    data: { slug, title, order: 0, isActive: true }, 
  }); 
  return NextResponse.json(created); 
} 
