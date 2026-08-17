import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { handleAcknowledgeSignal } from "@/server/ops/signals/adminSignalHandlers";
import prisma from "@/lib/prisma";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const result = await handleAcknowledgeSignal(prisma, user, id);
  return NextResponse.json(result.body, { status: result.status });
}
