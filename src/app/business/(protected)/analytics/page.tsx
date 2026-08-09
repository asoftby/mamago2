import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BusinessAnalyticsClient } from "@/components/business/analytics/BusinessAnalyticsClient";

export default async function BusinessAnalyticsPage() {
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

  const business = await getMyBusiness(user.id);
  if (!business) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        ...routing,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Analytics"
        title="Аналитика"
        description="Сколько людей увидело, открыло, сохранило и совершило целевое действие по вашим публикациям — события, предложения и места."
      />
      <BusinessAnalyticsClient />
    </div>
  );
}
