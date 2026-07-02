import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  nextResponseFromDirectAccessError,
  requireDirectThreadAccess,
} from "@/lib/auth/directAccess";
import {
  getUnifiedConversationDetail,
  resolveViewerRoleForThread,
} from "@/server/services/direct/directConversation.service";

/**
 * `id` is a DirectThread id (the URL stays stable — matches existing
 * notifyDirectCreated()/notifyDirectMessage() ctaAction links, both the
 * /me/direct/{id} customer links and the legacy /business/direct/{id}
 * business links, which now redirect here — see Phase 3.2). The response is
 * the MERGED conversation for that thread's (business, customer) pair, from
 * whichever side the caller is on — see directConversation.service.ts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, id);
  } catch (error) {
    return nextResponseFromDirectAccessError(error) ?? NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }
  const currentUser = user!;

  const resolved = await resolveViewerRoleForThread(currentUser.id, thread);
  if (!resolved) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const detail = await getUnifiedConversationDetail(
    resolved.businessId,
    resolved.customerUserId,
    resolved.viewerRole,
  );
  if (!detail) {
    return NextResponse.json({ error: "Direct thread not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
