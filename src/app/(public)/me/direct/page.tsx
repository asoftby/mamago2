import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getUnifiedConversationCountsForUser,
  getUnifiedConversationsForUser,
} from "@/server/services/direct/directConversation.service";
import { DirectListClient } from "./DirectListClient";

export const metadata: Metadata = {
  title: "Мои сообщения — mamaGo",
};

/**
 * The one "Мои сообщения" section for every role (Phase 3.2) — a plain user
 * sees only their own conversations with businesses; a business owner/member
 * sees those PLUS their business's conversations with its customers, merged
 * into the same list. No separate business inbox page.
 */
export default async function DirectListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [conversations, counts] = await Promise.all([
    getUnifiedConversationsForUser(user.id, "ALL"),
    getUnifiedConversationCountsForUser(user.id),
  ]);

  return <DirectListClient initialConversations={conversations} initialCounts={counts} />;
}
