import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { InboxPageClient } from "./InboxPageClient";

export default async function BusinessInboxPage() {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Кабинет"
        title="Входящие"
        description="Уведомления, новости и объявления от mamaGo"
      />
      <InboxPageClient />
    </div>
  );
}
