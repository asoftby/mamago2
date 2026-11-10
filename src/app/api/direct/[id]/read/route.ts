import { NextResponse } from "next/server";
import { DirectActorType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canAccessBusinessResource } from "@/server/permissions/business-permissions";
import {
  nextResponseFromDirectAccessError,
  requireDirectThreadAccess,
} from "@/lib/auth/directAccess";
import { markThreadRead } from "@/server/services/direct/directThread.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, id);
  } catch (error) {
    return nextResponseFromDirectAccessError(error) ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin/Moderator viewing a thread is not "reading as" either participant —
  // skip rather than incorrectly clearing one side's unread count for them.
  if (user!.role === "ADMIN" || user!.role === "MODERATOR") {
    return NextResponse.json({ markedCount: 0 });
  }

  const asBusiness = new URL(request.url).searchParams.get("as") === "business";
  if (asBusiness && !(await canAccessBusinessResource(user!, thread.businessId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const readerType = asBusiness || user!.id !== thread.customerUserId
    ? DirectActorType.BUSINESS
    : DirectActorType.CUSTOMER;

  const result = await markThreadRead({ threadId: thread.id, readerType });
  return NextResponse.json({ markedCount: result.count });
}
