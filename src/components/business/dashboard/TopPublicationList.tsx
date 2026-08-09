import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { buildPromotionLaunchHref } from "@/lib/promotion/shared";

type TopPublicationItem = {
  id: string;
  title: string;
  type: "event" | "offer";
  status: string;
  metrics: {
    views: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
};

function editorHref(item: TopPublicationItem) {
  return item.type === "event"
    ? `/business/events/${item.id}/edit`
    : `/business/offers/${item.id}/edit`;
}

export function TopPublicationList({
  items,
  promotionHref,
}: {
  items: TopPublicationItem[];
  promotionHref: string;
}) {
  if (items.length === 0) {
    return (
      <BusinessEmptyState
        icon={<Megaphone className="h-7 w-7" />}
        title="Пока нет публикаций с данными"
        description="Когда у событий и offers появятся просмотры, сохранения и переходы, здесь будет видно, какие публикации реально двигают спрос."
        ctaLabel="Открыть продвижение"
        ctaHref={promotionHref}
      />
    );
  }

  return (
    <BusinessSurfaceCard className="p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            Лучшие публикации
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
            Список собран по реальным действиям: лиды, сохранения и интерес к публикации.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/business/analytics"
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
          >
            Вся аналитика
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href={promotionHref}
            className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
          >
            Продвижение
            <Megaphone className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.type}:${item.id}`}
            className="flex flex-col gap-4 rounded-[24px] border border-stone-200/90 bg-stone-50/70 p-4 transition hover:border-stone-300 hover:bg-white md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BusinessChip tone="muted" size="compact">
                  {item.type === "event" ? "Event" : "Offer"}
                </BusinessChip>
                <span className="text-xs text-stone-400">{item.status}</span>
              </div>
              <p className="mt-2 truncate text-base font-semibold text-stone-950 md:text-lg">
                {item.title}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <BusinessChip>Просмотры: {item.metrics.views}</BusinessChip>
                <BusinessChip>Сохранения: {item.metrics.saves}</BusinessChip>
                <BusinessChip>В план: {item.metrics.planAdds}</BusinessChip>
                <BusinessChip>Переходы: {item.metrics.ctaClicks}</BusinessChip>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start md:self-center">
              <Link
                href={editorHref(item)}
                className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
              >
                Редактировать
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildPromotionLaunchHref({
                  publicationType: item.type === "event" ? "EVENT" : "OFFER",
                  publicationId: item.id,
                })}
                className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Продвигать
                <Megaphone className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </BusinessSurfaceCard>
  );
}
