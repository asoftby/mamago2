import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { countConversationsByTab, getBusinessConversationsForUser } from "@/server/services/direct/directConversation.service";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BusinessDirectInbox } from "./BusinessDirectInbox";

export default async function BusinessDirectPage() {
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
      <BusinessDirectInbox initialConversations={all} initialCounts={counts} />
    </div>
  );
}
