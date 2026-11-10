import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
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

/** Personal customer thread; legacy business links are forwarded to the B2B screen. */
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

  // Old business notifications/bookmarks may still point at /me/direct/[id].
  // Keep personal pages customer-only and forward authorized business threads
  // into the business shell rather than rendering them in the personal profile.
  if (thread.customerUserId !== user.id) {
    const business = await getMyBusiness(user.id);
    if (!business || business.id !== thread.businessId) notFound();
    const routing = await getCurrentRequestRoutingContext();
    redirect(buildSurfaceRedirectDestination({
      targetSurface: "business",
      targetPath: `/direct/${threadId}`,
      ...routing,
    }));
  }

  const resolved = await resolveViewerRoleForThread(user.id, thread);
  if (!resolved || resolved.viewerRole !== "CUSTOMER") notFound();

  const detail = await getUnifiedConversationDetail(
    resolved.businessId,
    resolved.customerUserId,
    resolved.viewerRole,
  );
  if (!detail) notFound();

  return <DirectThreadClient initialDetail={detail} />;
}
