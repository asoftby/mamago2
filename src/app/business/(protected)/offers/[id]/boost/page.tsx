import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { getConfiguredBoostOptions } from "@/server/services/billing/boostPurchase.service";
import { BoostPurchaseClient } from "./BoostPurchaseClient";

export default async function OfferBoostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  const { id } = await params;
  const offer = await prisma.offer.findFirst({
    where: { id, place: { ownerBusinessId: business.id } },
    select: { id: true, title: true, status: true, archivedAt: true },
  });
  if (!offer) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Explicit paid action</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-950">Boost: {offer.title}</h1>
        <p className="mt-2 text-sm text-stone-600">Boost — единственное платное действие first PROD. Лиды и контакты бесплатны.</p>
      </div>
      {offer.status !== "PUBLISHED" || offer.archivedAt ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Boost доступен только для опубликованного активного предложения.
        </div>
      ) : (
        <BoostPurchaseClient offerId={offer.id} options={getConfiguredBoostOptions()} />
      )}
    </div>
  );
}
