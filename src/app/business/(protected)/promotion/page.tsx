import { redirect } from "next/navigation";
import { PromotionPublicationType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { PromotionOverviewClient } from "@/components/business/promotion/PromotionOverviewClient";
import { getPromotionOverviewData, getPromotionTargetForBusiness } from "@/server/services/promotion/promotion.service";
import { getBusinessBillingSummary } from "@/server/services/billing/billingBusiness.service";

type PromotionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BusinessPromotionOverviewPage({
  searchParams,
}: PromotionPageProps) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
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

  const rawSearchParams = (await searchParams) ?? {};
  const publicationId =
    typeof rawSearchParams.publicationId === "string"
      ? rawSearchParams.publicationId
      : undefined;
  const publicationType =
    rawSearchParams.publicationType === PromotionPublicationType.EVENT ||
    rawSearchParams.publicationType === PromotionPublicationType.OFFER
      ? rawSearchParams.publicationType
      : undefined;

  const [summary, selectedTarget, billingSummary] = await Promise.all([
    getPromotionOverviewData(business.id),
    publicationId && publicationType
      ? getPromotionTargetForBusiness({
          businessId: business.id,
          publicationId,
          publicationType,
        })
      : Promise.resolve(null),
    getBusinessBillingSummary(business.id),
  ]);

  const depositBalance = billingSummary?.account.depositBalance?.toNumber() ?? 0;

  const overviewHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/promotion",
    ...routing,
  });
  const eventsHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/events",
    ...routing,
  });
  const offersHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/offers",
    ...routing,
  });
  const depositHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/billing/deposit",
    ...routing,
  });
  const dashboardHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/dashboard",
    ...routing,
  });

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Promotion"
        title="Продвижение"
        description="Здесь видно, куда уходит promotion budget, какие публикации уже получают спрос и где есть следующий безопасный шаг для роста."
      />

      <PromotionOverviewClient
        overviewHref={overviewHref}
        eventsHref={eventsHref}
        offersHref={offersHref}
        dashboardHref={dashboardHref}
        depositHref={depositHref}
        depositBalance={depositBalance}
        totalBudget={summary.totalBudget}
        totalSpend={summary.totalSpend}
        totalSaveToPlan={summary.totalSaveToPlan}
        totalLeads={summary.totalLeads}
        activeCount={summary.activeCount}
        costPerSave={summary.costPerSave}
        costPerLead={summary.costPerLead}
        promotions={summary.promotions}
        selectedTarget={selectedTarget}
      />
    </div>
  );
}
