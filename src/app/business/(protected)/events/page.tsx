import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { EventsList } from "./EventsList";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  // Verify user has a business
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
  });

  if (!business) {
    console.warn(`User ${user.email} has BUSINESS_OWNER role but no Business entity`);
    redirect("/business/onboarding");
  }

  const params = await searchParams;
  const view = params.view || "active";

  // Fetch activities (events) for this user
  // Note: Using Activity model as data source, but presenting as "Events" in UI
  const activities = await prisma.activity.findMany({
    where: {
      ownerUserId: user.id,
      // Filter by archived status if needed (assuming we'll add this field later)
      // For now, just fetch all
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Мои события</h1>
        <p className="text-gray-600 mt-2">
          Управляйте вашими событиями и отслеживайте их статус
        </p>
      </div>

      <EventsList activities={activities} currentView={view} />
    </div>
  );
}
