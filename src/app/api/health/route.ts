import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBuildInfo } from "@/lib/system/buildInfo";
import { getProcessStartedAt } from "@/lib/system/runtimeStart";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const { buildId, commitSha } = getBuildInfo();
    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        buildId,
        gitSha: commitSha,
        processStartedAt: getProcessStartedAt(),
      },
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
