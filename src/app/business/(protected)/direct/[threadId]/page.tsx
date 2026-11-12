import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canAccessBusiness } from "@/server/permissions/business-permissions";
import { isDirectAccessError, requireDirectThreadAccess } from "@/lib/auth/directAccess";
import { getUnifiedConversationDetail } from "@/server/services/direct/directConversation.service";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { DirectThreadClient } from "@/app/(public)/me/direct/[threadId]/DirectThreadClient";

export default async function BusinessDirectThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { threadId } = await params;

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, threadId);
  } catch (error) {
    if (isDirectAccessError(error)) notFound();
    throw error;
  }
  // A personal customer thread is never a business-cabinet thread,
  // even if its customer also happens to own a business.
  if (!(await canAccessBusiness(user.id, thread.businessId))) notFound();

  const detail = await getUnifiedConversationDetail(
    thread.businessId,
    thread.customerUserId,
    "BUSINESS",
  );
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Сообщения"
        description="Переписка с клиентами вашей организации"
      />
      <DirectThreadClient initialDetail={detail} businessMode />
    </div>
  );
}
