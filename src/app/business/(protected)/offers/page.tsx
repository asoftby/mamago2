import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OffersList } from "./OffersList";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  
  if (!user || !canCreateBusinessContent(user.role)) {
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

  // Fetch offers for user's places
  const userPlaces = await prisma.place.findMany({
    where: { ownerUserId: user.id },
    select: { id: true },
  });

  const placeIds = userPlaces.map(p => p.id);

  const offers = placeIds.length > 0
    ? await prisma.offer.findMany({
        where: {
          placeId: { in: placeIds },
        },
        include: {
          place: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Мои предложения</h1>
        <p className="text-gray-600 mt-2">
          Управляйте вашими предложениями и специальными акциями
        </p>
      </div>

      <OffersList offers={offers} currentView={view} />
    </div>
  );
}
