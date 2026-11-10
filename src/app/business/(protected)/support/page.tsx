import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { SupportInbox } from "@/features/support/SupportInbox";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { redirect } from "next/navigation";

export default async function BusinessSupportPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business");
  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Поддержка mamaGo"
        description="Обращения в поддержку отдельно от переписки с клиентами."
      />
      <SupportInbox businessId={business.id} initialThreadId={thread} embedded />
    </div>
  );
}
