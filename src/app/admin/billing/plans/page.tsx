import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { AdminBillingPricingClient } from "@/components/admin/billing/AdminBillingPricingClient";
import { getPlans } from "@/server/services/billing/billingPlans.service";
import {
  ensureDefaultBillingActionRates,
  getBusinessResolvedBillingActionPrices,
  listBillingActionRates,
} from "@/server/services/billing/billingActionRateResolver.service";

function serializeRate(rate: Awaited<ReturnType<typeof listBillingActionRates>>[number]) {
  return {
    id: rate.id,
    actionType: rate.actionType,
    scopeType: rate.scopeType,
    scopeId: rate.scopeId,
    pricingType: rate.pricingType,
    fixedAmount: rate.fixedAmount?.toNumber() ?? null,
    percentRate: rate.percentRate?.toNumber() ?? null,
    minimumAmount: rate.minimumAmount?.toNumber() ?? null,
    maximumAmount: rate.maximumAmount?.toNumber() ?? null,
    currency: rate.currency,
    isActive: rate.isActive,
    startsAt: rate.startsAt?.toISOString() ?? null,
    endsAt: rate.endsAt?.toISOString() ?? null,
    reason: rate.reason,
    createdById: rate.createdById,
    createdAt: rate.createdAt.toISOString(),
    updatedAt: rate.updatedAt.toISOString(),
  };
}

export default async function AdminBillingPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  await ensureDefaultBillingActionRates(user.id);

  const { businessId } = await searchParams;
  const [globalRates, businessRates, resolvedPrices, legacyPlans, businessContext] = await Promise.all([
    listBillingActionRates({
      scopeType: "GLOBAL",
      includeInactive: true,
    }),
    businessId
      ? listBillingActionRates({
          scopeType: "BUSINESS",
          scopeId: businessId,
          includeInactive: true,
        })
      : Promise.resolve([]),
    businessId
      ? getBusinessResolvedBillingActionPrices({ businessId })
      : Promise.resolve([]),
    getPlans(),
    businessId
      ? prisma.business.findUnique({
          where: { id: businessId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  type ResolvedPriceRow = (typeof resolvedPrices)[number];

  return (
    <div className="p-6 md:p-4">
      <AdminBillingPricingClient
        initialGlobalRates={globalRates.map(serializeRate)}
        initialBusinessRates={businessRates.map(serializeRate)}
        initialResolvedPrices={resolvedPrices.map((item: ResolvedPriceRow) => ({
          actionType: item.actionType,
          source: item.source,
          rule: item.rule ? serializeRate(item.rule) : null,
        }))}
        businessContext={businessContext}
        legacyPlans={legacyPlans}
      />
    </div>
  );
}
