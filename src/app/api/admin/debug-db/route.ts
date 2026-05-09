import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Development-only DB connectivity check. Never expose connection strings or secrets.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let now: string | null = null;
  let counts = { signals: -1, filters: -1 };

  try {
    const result = await prisma.$queryRaw<{ now: Date }[]>`
      SELECT now() AS now
    `;
    if (Array.isArray(result) && result.length > 0) {
      now = result[0].now.toISOString();
    }

    counts = {
      signals: await prisma.signalDefinition.count(),
      filters: await prisma.filterDefinition.count(),
    };
  } catch (e) {
    console.error("[admin/debug-db] DB check failed");
    if (e instanceof Error) {
      console.error(e.message);
    }
  }

  return NextResponse.json({
    ok: true,
    environment: "development",
    now,
    counts,
  });
}
