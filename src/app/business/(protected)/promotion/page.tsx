import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { getPromotionOverviewData } from "@/server/services/promotion/promotion.service";
import { formatPrice } from "@/lib/formatters/format-price";

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

  void searchParams;
  const summary = await getPromotionOverviewData(business.id);

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Promotion"
        title="Продвижение"
        description="Action-based paid Promotion отключён для first PROD. Существующая история доступна только для чтения."
      />
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Новые кампании и автоматические списания выключены. Единственное платное действие — явная покупка Boost для опубликованного Offer.
      </div>
      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-950">История Promotion</h2>
        {summary.promotions.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Исторических кампаний нет.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {summary.promotions.map((promotion) => (
              <div key={promotion.id} className="rounded-2xl border border-stone-200 p-4 text-sm">
                <p className="font-semibold text-stone-950">{promotion.publicationTitle}</p>
                <p className="mt-1 text-stone-600">Статус: {promotion.status} · списано исторически: {formatPrice(promotion.spent)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
