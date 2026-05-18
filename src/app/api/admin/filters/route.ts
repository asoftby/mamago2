import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const items = await prisma.filterDefinition.findMany({
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    include: { options: { orderBy: [{ order: "asc" }, { value: "asc" }] } },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json(); 
  const slug = String(body.slug || "").trim(); 
  const title = String(body.title || "").trim(); 
  const type = String(body.type || "single").trim();
  const ui = String(body.ui || "tabs").trim();

  if (!slug || !title) return NextResponse.json({ ok:false, error:"slug and title required" }, { status: 400 }); 

  const created = await prisma.filterDefinition.create({ 
    data: { slug, title, type, ui, order: 0, isActive: true }, 
  }); 
  return NextResponse.json(created); 
} 
