import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { handleSnoozeSignal } from "@/server/ops/signals/adminSignalHandlers";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await handleSnoozeSignal(prisma, user, id, (body as { choice?: unknown }).choice);
  return NextResponse.json(result.body, { status: result.status });
}
