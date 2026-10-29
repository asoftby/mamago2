import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getBusinessMembership } from "@/server/permissions/business-permissions";
import { isSupportStaff, requireSupportBusinessAccess, SupportAccessError } from "@/server/support/supportAccess";

const createInput = z.object({
  businessId: z.string().min(1),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(3000),
});
function failure(e: unknown) {
  if (e instanceof SupportAccessError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError) return NextResponse.json({ error: "Validation error" }, { status: 400 });
  console.error("[support] request failed", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const businessId = request.nextUrl.searchParams.get("businessId");
  try {
    if (!isSupportStaff(user) && !businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
    if (businessId) await requireSupportBusinessAccess(user, businessId);
    const where = isSupportStaff(user)
      ? (businessId ? { businessId } : {})
      : { businessId: businessId! };
    const threads = await prisma.supportThread.findMany({
      where, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: 21, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, businessId: true, subject: true, status: true, lastMessageAt: true, createdAt: true },
    });
    return NextResponse.json({ threads: threads.slice(0, 20), nextCursor: threads.length > 20 ? threads[19].id : null });
  } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (isSupportStaff(user)) return NextResponse.json({ error: "Staff must reply to an existing thread" }, { status: 403 });
  const limit = await checkRateLimit(`support_create:${user.id}`, 5, 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    const input = createInput.parse(await request.json());
    // Transactional membership guard prevents a deleted membership from being silently accepted.
    const membership = await getBusinessMembership(user.id, input.businessId);
    if (!membership) throw new SupportAccessError(404, "Business not found");
    const thread = await prisma.supportThread.create({ data: {
      id: randomUUID(), businessId: input.businessId, createdById: user.id, subject: input.subject,
      messages: { create: { id: randomUUID(), authorId: user.id, actor: "BUSINESS", body: input.body } },
    }, select: { id: true, businessId: true, status: true } });
    return NextResponse.json(thread, { status: 201 });
  } catch (e) { return failure(e); }
}
