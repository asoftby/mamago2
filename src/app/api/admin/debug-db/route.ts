import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.DATABASE_URL || "NO_DATABASE_URL";
  let now = null;
  let counts = { signals: -1, filters: -1 };
  
  try {
    const result = await prisma.$queryRawUnsafe<{ now: Date }[]>(`select now() as now`);
    if (Array.isArray(result) && result.length > 0) {
        now = result[0].now;
    }
    
    counts = {
      signals: await prisma.signalDefinition.count(),
      filters: await prisma.filterDefinition.count(),
    };
  } catch (e) {
    console.error("DB Connection Error:", e);
  }

  return NextResponse.json({ url, now, counts });
}
