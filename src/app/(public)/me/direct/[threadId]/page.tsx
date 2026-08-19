import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import {
  isDirectAccessError,
  requireDirectThreadAccess,
} from "@/lib/auth/directAccess";
import {
  getUnifiedConversationDetail,
  resolveViewerRoleForThread,
} from "@/server/services/direct/directConversation.service";
import { DirectThreadClient } from "./DirectThreadClient";

export const metadata: Metadata = {
  title: "Мои сообщения — mamaGo",
};

/**
 * The URL param is a single DirectThread id (kept stable — both the
 * /me/direct/{id} customer links and the legacy /business/direct/{id}
 * business links, which now redirect here, point at it). The page renders
 * the MERGED conversation for that thread's (business, customer) pair, from
 * whichever side the current user is on — see directConversation.service.ts.
 */
export default async function DirectThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, threadId);
  } catch (error) {
    if (isDirectAccessError(error)) {
      // Never distinguish 403 from 404 to the browser here — that would
      // confirm a thread's existence to someone who isn't a participant.
      notFound();
    }
    throw error;
  }

  const resolved = await resolveViewerRoleForThread(user.id, thread);
  if (!resolved) notFound();

  const detail = await getUnifiedConversationDetail(
    resolved.businessId,
    resolved.customerUserId,
    resolved.viewerRole,
  );
  if (!detail) notFound();

  return <DirectThreadClient initialDetail={detail} />;
}
