import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getPromotionOverviewData } from "@/server/services/promotion/promotion.service";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { getPromotionPublicationLabel } from "@/lib/promotion/shared";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-BY", {
    style: "currency",
    currency: "BYN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function BusinessPromotionCampaignsPage() {
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

  const summary = await getPromotionOverviewData(business.id);
  const overviewHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/promotion",
    ...routing,
  });

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Promotion"
        title="Campaigns"
        description="Здесь собраны конкретные promotion-запуски: что продвигается, в каком статусе находится и сколько бюджета уже конвертировалось в результат."
      />

      {summary.promotions.length === 0 ? (
        <BusinessEmptyState
          icon={<Megaphone className="h-7 w-7" />}
          title="Campaigns пока нет"
          description="Первый promotion-запуск появится здесь сразу после старта продвижения для события или offer."
          ctaLabel="Открыть Overview"
          ctaHref={overviewHref}
        />
      ) : (
        <BusinessSurfaceCard className="p-6 md:p-7">
          <div className="space-y-3">
            {summary.promotions.map((promotion) => (
              <div
                key={promotion.id}
                className="rounded-[24px] border border-stone-200/90 bg-stone-50/70 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <BusinessChip tone="muted" size="compact">
                    {getPromotionPublicationLabel(promotion.publicationType)}
                  </BusinessChip>
                  <BusinessChip size="compact">{promotion.status}</BusinessChip>
                </div>
                <p className="mt-3 text-lg font-semibold tracking-tight text-stone-950">
                  {promotion.publicationTitle}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <BusinessChip>Бюджет: {formatMoney(promotion.budget)}</BusinessChip>
                  <BusinessChip>Потрачено: {formatMoney(promotion.spent)}</BusinessChip>
                  <BusinessChip>Сохранения: {promotion.saveToPlanCount}</BusinessChip>
                  <BusinessChip>Лиды: {promotion.leadCount}</BusinessChip>
                </div>
              </div>
            ))}
          </div>
        </BusinessSurfaceCard>
      )}
    </div>
  );
}
