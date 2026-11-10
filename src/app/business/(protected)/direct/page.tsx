import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessConversationsForUser } from "@/server/services/direct/directConversation.service";
import { BusinessDirectListClient } from "./BusinessDirectListClient";

export const metadata: Metadata = { title: "Сообщения | mamaGo Business" };

/** Business inbox stays under the business shell; personal chats remain in /me/direct. */
export default async function BusinessDirectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const business = await getMyBusiness(user.id);
  if (!business) notFound();

  const conversations = await getBusinessConversationsForUser(user.id, business.id);

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Сообщения"
        description="Переписки с клиентами по вашим событиям, местам и предложениям"
      />
      <BusinessDirectListClient initialConversations={conversations} />
    </div>
  );
}
