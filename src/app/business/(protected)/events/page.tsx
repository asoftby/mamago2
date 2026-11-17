import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { normalizeBusinessEventListView } from "@/lib/business/eventListWhere";
import { EventsList } from "./EventsList";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessEventsList } from "@/server/services/business/businessEventsList.service";

interface SearchParams {
  view?: "active" | "archived" | "archive";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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

  const params = await searchParams;
  const view = normalizeBusinessEventListView(params.view);

  const activitiesWithMetrics = await getBusinessEventsList({
    userId: user.id,
    businessId: business.id,
    view,
  });

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="ИНФРАСТРУКТУРА"
        title="События"
        description="События — это регулярный входящий спрос. Здесь важно сразу видеть статус, интерес и что стоит усилить следующим."
      />

      <EventsList activities={activitiesWithMetrics} currentView={view} />
    </div>
  );
}
