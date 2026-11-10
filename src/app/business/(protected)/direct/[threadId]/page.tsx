import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { isDirectAccessError, requireDirectThreadAccess } from "@/lib/auth/directAccess";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getUnifiedConversationDetail } from "@/server/services/direct/directConversation.service";
import { DirectThreadClient } from "@/app/(public)/me/direct/[threadId]/DirectThreadClient";

export const metadata: Metadata = { title: "Переписка | mamaGo Business" };

export default async function BusinessDirectThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const business = await getMyBusiness(user.id);
  if (!business) notFound();

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, threadId);
  } catch (error) {
    if (isDirectAccessError(error)) notFound();
    throw error;
  }
  // A user may also have private customer threads. Business routes must
  // never open them, even when requireDirectThreadAccess permits customer access.
  if (thread.businessId !== business.id) notFound();

  const detail = await getUnifiedConversationDetail(
    business.id,
    thread.customerUserId,
    "BUSINESS",
  );
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Переписка с клиентом"
        description="История обращений и сообщений с одним клиентом"
      />
      <DirectThreadClient initialDetail={detail} surface="business" />
    </div>
  );
}
