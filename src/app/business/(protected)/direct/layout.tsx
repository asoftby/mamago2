import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import {
  countConversationsByTab,
  getBusinessConversationsForUser,
} from "@/server/services/direct/directConversation.service";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { DirectInbox } from "@/components/direct/DirectInbox";

/** Two-column business inbox; the list is fetched once and kept while dialogs change. */
export default async function BusinessDirectLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  // Query only this organization’s conversations: personal direct messages stay in /me/direct.
  const all = await getBusinessConversationsForUser(user.id, business.id);
  const counts = countConversationsByTab(all);

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Сообщения"
        description="Переписка с клиентами по вашим событиям, местам и предложениям"
      />
      <DirectInbox variant="business" initialConversations={all} initialCounts={counts}>
        {children}
      </DirectInbox>
    </div>
  );
}
