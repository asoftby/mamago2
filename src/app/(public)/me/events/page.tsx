import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { excludeDeletedEvents, excludeGhostEventDrafts } from "@/lib/business/eventListWhere";
import { EventsList } from "@/app/business/(protected)/events/EventsList";
import { Container } from "@/components/ui/Container";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function MeEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
  });

  if (!business) {
    redirect("/business/onboarding");
  }

  const params = await searchParams;
  const view = params.view || "active";

  const activities = await prisma.activity.findMany({
    where: {
      ownerUserId: user.id,
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
    <Container className="py-8 sm:py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Мои события</h1>
          <p className="mt-2 text-gray-600">
            Управляйте вашими событиями и отслеживайте их статус
          </p>
        </div>

        <EventsList activities={activities} currentView={view} />
      </div>
    </Container>
  );
}
