import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";

export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const territories = await prisma.territory.findMany({
    where: { type: "CITY", isActive: true },
    select: { id: true, name: true, parent: { select: { name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(territories);
}
