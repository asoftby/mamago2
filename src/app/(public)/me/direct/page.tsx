import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countConversationsByTab,
  getCustomerConversationsForUser,
} from "@/server/services/direct/directConversation.service";
import { DirectListClient } from "./DirectListClient";

export const metadata: Metadata = {
  title: "Мои сообщения — mamaGo",
};

/** Personal messages only. The B2B inbox lives under /business/direct. */
export default async function DirectListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await getCustomerConversationsForUser(user.id);
  const counts = countConversationsByTab(conversations);

  return <DirectListClient initialConversations={conversations} initialCounts={counts} />;
}
