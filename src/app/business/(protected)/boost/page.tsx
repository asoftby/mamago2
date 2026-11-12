import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getDailyFreeBoostDashboardData } from "@/server/services/promotion/dailyFreeBoost.service";
import { DailyFreeBoostCard } from "@/components/business/dashboard/DailyFreeBoostCard";
import type { DashboardData } from "@/components/business/dashboard/DashboardClient";

export default async function BusinessBoostHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ publicationType?: string; publicationId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  const query = (await searchParams) ?? {};
  const initialTarget =
    (query.publicationType === "EVENT" || query.publicationType === "OFFER") &&
    query.publicationId
      ? `${query.publicationType}:${query.publicationId}`
      : undefined;

  const current = await getDailyFreeBoostDashboardData({
    businessId: business.id,
    userId: user.id,
  });
  const data: DashboardData["dailyFreeBoost"] = {
    availableToday: current.availableToday,
    nextFreeAt: current.nextFreeAt?.toISOString() ?? null,
    candidates: current.candidates,
    boost: current.boost
      ? {
          ...current.boost,
          startAt: current.boost.startAt.toISOString(),
          endAt: current.boost.endAt.toISOString(),
        }
      : null,
  };

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-950">Boost публикаций</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Выберите опубликованное событие или предложение. Раз в 24 часа
          доступно одно бесплатное поднятие в своём регионе. Другие
          публикации можно продвигать платно, если тарифы активированы.
          Результат зависит от интересов семьи и актуальности публикации.
        </p>
      </div>
      <DailyFreeBoostCard key={initialTarget ?? "general"} data={data} initialTarget={initialTarget} />
    </main>
  );
}
