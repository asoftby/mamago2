import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countConversationsByTab,
  getCustomerConversationsForUser,
} from "@/server/services/direct/directConversation.service";
import { DirectInbox } from "@/components/direct/DirectInbox";

/**
 * Two-column personal messages: the conversation list is fetched once here and
 * stays mounted while the user moves between dialogs (the routed page is the
 * right-hand column). Personal messages only — the B2B inbox lives under /business/direct.
 */
export default async function DirectLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await getCustomerConversationsForUser(user.id);
  const counts = countConversationsByTab(conversations);

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DirectInbox variant="customer" initialConversations={conversations} initialCounts={counts}>
        {children}
      </DirectInbox>
    </main>
  );
}
