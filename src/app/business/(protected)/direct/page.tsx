import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getUnifiedConversationsForUser, type ConversationTab } from "@/server/services/direct/directConversation.service";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BusinessDirectInbox } from "./BusinessDirectInbox";

export default async function BusinessDirectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  // The shared aggregation also contains the user's personal customer-side conversations.
  // Select only threads belonging to the active business; never send personal cards to the B2B UI.
  const all = (await getUnifiedConversationsForUser(user.id)).filter(
    (item) => item.viewerRole === "BUSINESS" && item.key.startsWith(`${business.id}:`),
  );
  const counts: Record<ConversationTab, number> = {
    ALL: all.length,
    ACTIVE: 0,
    WAITING: 0,
    COMPLETED: 0,
    ARCHIVE: 0,
  };
  for (const item of all) counts[item.tab] += 1;

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
