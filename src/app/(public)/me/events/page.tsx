import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { excludeDeletedEvents, excludeGhostEventDrafts } from "@/lib/business/eventListWhere";
import { EventsList } from "@/app/business/(protected)/events/EventsList";
import { AccountPage } from "@/components/account/AccountPage";
import { getPartnerCabinetBusiness } from "@/server/permissions/business-permissions";

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
  const view = params.view || "active";

  const activities = await prisma.activity.findMany({
    where: {
      businessId: business.id,
      type: ActivityType.EVENT,
      ...excludeDeletedEvents(),
      ...excludeGhostEventDrafts(),
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AccountPage
      title="Мои события"
      lead="Управляйте вашими событиями и отслеживайте их статус"
      backHref="/me"
    >
      <EventsList activities={activities} currentView={view} />
    </AccountPage>
  );
}
