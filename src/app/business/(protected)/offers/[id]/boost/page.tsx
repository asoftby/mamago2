import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { getConfiguredBoostOptions } from "@/server/services/billing/boostPurchase.service";
import { BoostPurchaseClient } from "./BoostPurchaseClient";
import { listBoostTargetRegions } from "@/server/geo/boostRegionTargeting";
import { isBoostableOfferProductType } from "@/lib/promotion/boostableOfferTypes";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";

export default async function OfferBoostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  const { id } = await params;
  const offer = await prisma.offer.findFirst({
    where: { id, place: { ownerBusinessId: business.id } },
    select: { id: true, title: true, status: true, archivedAt: true, kind: true, productType: true },
  });
  if (!offer) notFound();

  const regions = await listBoostTargetRegions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BusinessSectionHeader
        eyebrow="Explicit paid action"
        title={`Boost: ${offer.title}`}
        description="Boost — единственное платное действие first PROD. Лиды и контакты бесплатны."
      />
      {offer.status !== "PUBLISHED" || offer.archivedAt || !isBoostableOfferProductType(offer.kind, offer.productType) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Boost доступен только для опубликованной активной услуги, которая участвует в каталожной выдаче.
        </div>
      ) : (
        <BoostPurchaseClient offerId={offer.id} options={getConfiguredBoostOptions()} regions={regions} />
      )}
    </div>
  );
}
