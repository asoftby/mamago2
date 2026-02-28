import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() { 
  const filters = await prisma.filterDefinition.findMany({
    where: {
      isActive: true,
      placement: { not: "HIDDEN" }, // Exclude hidden filters
    },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" }, // Order options by orderIndex
      },
    },
    orderBy: { orderIndex: "asc" }, // Order filters by orderIndex
  });

  return NextResponse.json({ filters }); 
} 
