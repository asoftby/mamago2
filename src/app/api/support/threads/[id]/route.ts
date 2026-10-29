import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { requireSupportThreadAccess, SupportAccessError } from "@/server/support/supportAccess";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  try {
    const { id } = await params;
    await requireSupportThreadAccess(user, id);
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const messages = await prisma.supportMessage.findMany({
      where: { threadId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, actor: true, body: true, createdAt: true },
    });
    return NextResponse.json({ messages: messages.slice(0, 30).reverse(), nextCursor: messages.length > 30 ? messages[29].id : null });
  } catch (e) {
    if (e instanceof SupportAccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[support] thread read failed", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
