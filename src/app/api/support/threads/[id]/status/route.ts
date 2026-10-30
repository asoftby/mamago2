import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isSupportStaff, requireSupportThreadAccess, SupportAccessError } from "@/server/support/supportAccess";

const schema = z.object({ status: z.enum(["NEW", "IN_PROGRESS", "CLOSED"]) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isSupportStaff(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limit = await checkRateLimit(`support_status:${user.id}`, 30, 60000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    const { id } = await params;
    await requireSupportThreadAccess(user, id);
    const { status } = schema.parse(await request.json());
    const updated = await prisma.supportThread.update({
      where: { id }, data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof SupportAccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Validation error" }, { status: 400 });
    console.error("[support] status update failed", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
