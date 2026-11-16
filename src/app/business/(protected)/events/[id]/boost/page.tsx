import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { getConfiguredBoostOptions } from "@/server/services/billing/boostPurchase.service";
import { listBoostTargetRegions } from "@/server/geo/boostRegionTargeting";
import { BoostPurchaseClient } from "@/app/business/(protected)/offers/[id]/boost/BoostPurchaseClient";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";

export default async function EventBoostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  const { id } = await params;
  const event = await prisma.activity.findFirst({
    where: { id, OR: [{ businessId: business.id }, { ownerUserId: user.id }], type: "EVENT" },
    select: { id: true, title: true, status: true },
  });
  if (!event) notFound();
  const regions = await listBoostTargetRegions();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BusinessSectionHeader
        title={`Boost события: ${event.title}`}
        description="Продвигайте событие в выбранных областях или по всей Беларуси."
      />
      {event.status !== "PUBLISHED" ? (
        <p className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">Boost доступен только для опубликованного события.</p>
      ) : (
        <BoostPurchaseClient eventId={event.id} options={getConfiguredBoostOptions()} regions={regions} />
      )}
    </div>
  );
}
