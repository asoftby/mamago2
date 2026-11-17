import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { normalizeBusinessEventListView } from "@/lib/business/eventListWhere";
import { EventsList } from "@/app/business/(protected)/events/EventsList";
import { AccountPage } from "@/components/account/AccountPage";
import { getPartnerCabinetBusiness } from "@/server/permissions/business-permissions";
import { getBusinessEventsList } from "@/server/services/business/businessEventsList.service";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function MeEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const business = await getPartnerCabinetBusiness(user.id);
  if (!business) {
    redirect("/business/onboarding");
  }

  const params = await searchParams;
  const view = normalizeBusinessEventListView(params.view);

  // Тот же серверный источник, что и у бизнес-маршрутов: даты, статус по
  // расписанию и состояние Boost считаются в одном месте.
  const activities = await getBusinessEventsList({
    userId: user.id,
    businessId: business.id,
    view,
  });

  return (
    <AccountPage
      title="Мои события"
      lead="Управляйте вашими событиями и отслеживайте их статус"
    >
      <EventsList activities={activities} currentView={view} />
    </AccountPage>
  );
}
