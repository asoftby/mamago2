import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "ok" },
      { status: 200 },
    );
  } catch (err) {
    console.error("[healthcheck] db error:", err);
    return NextResponse.json(
      { status: "error", db: "unavailable" },
      { status: 503 },
    );
  }
}
