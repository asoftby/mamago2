"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSetPublicationIntent } from "@/contexts/PublicationIntentContext";
import { toast } from "sonner";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { formatRuSessionHero } from "@/lib/event/eventPageFormat";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { EventAboutSection } from "./EventAboutSection";
import { EventDecisionPanel } from "./EventDecisionPanel";
import { EventFactsGrid } from "./EventFactsGrid";
import { EventGoodFit } from "./EventGoodFit";
import { EventMediaStack } from "./EventMediaStack";
import { EventOrganizerNotes } from "./EventOrganizerNotes";
import { EventPlanDayCta } from "./EventPlanDayCta";
import { EventSessionSelector } from "./EventSessionSelector";
import { EventStickyActionBar } from "./EventStickyActionBar";
import { EventVenueBlock } from "./EventVenueBlock";
import { EventWhyGo } from "./EventWhyGo";
import { SimilarEventsSection } from "./SimilarEventsSection";
import { PublicationStatsPanel } from "@/components/publication-stats";

function venueOneLine(data: EventPageData): string | undefined {
  const v = data.venue;
  if (!v) return undefined;
  const parts = [v.name, v.address].filter(Boolean);
  return parts.join(" · ");
}

export function EventPageView({ data }: { data: EventPageData }) {
  const setPublicationIntent = useSetPublicationIntent();
  useEffect(() => {
    setPublicationIntent(data.discoveryIntent);
    return () => setPublicationIntent(null);
  }, [data.discoveryIntent, setPublicationIntent]);

  const sessions = data.sessions;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.sessions[0]?.id ?? null
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? sessions[0],
    [sessions, selectedId]
  );

  const sessionLineHero = selectedSession
    ? formatRuSessionHero(selectedSession.startsAt)
    : sessions.length === 0
      ? "Расписание уточняется"
      : undefined;

  const sessionLineSticky = selectedSession
    ? formatRuSessionHero(selectedSession.startsAt)
    : undefined;

  const venueShort = venueOneLine(data);

  const handlePlan = useCallback(() => {
    toast.message("В план", {
      description: "Подключите сохранение в план, когда будет готов backend.",
    });
  }, []);

  const handleBuy = useCallback(() => {
    toast.message(data.cta.buyLabel, {
      description: "Здесь будет ссылка на покупку или сайт организатора.",
    });
  }, [data.cta.buyLabel]);

  const handleSave = useCallback(() => {
    const was = isFavorite(data.id);
    toggleFavorite(data.id);
    toast.success(was ? "Убрано из идей" : "Сохранено в идеи", {
      description: was
        ? "Удалено из избранного на этом устройстве."
        : "Событие в избранном на этом устройстве.",
    });
  }, [data.id]);

  const handlePlanSimilar = useCallback((id: string) => {
    toggleFavorite(id);
    toast.success("В план", { description: `Событие ${id} — заглушка действия.` });
  }, []);

  const hasSimilar = data.similar.length > 0;

  return (
    <div className="min-h-screen bg-background pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-28">
      {/* Как в SiteHeaderShell: max-w-[1200px] px-4 */}
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:pt-8 lg:pt-10">
        {data.previewBannerLabel && (
          <div
            role="status"
            className="mb-6 flex items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-center text-[14px] font-medium text-amber-950 dark:text-amber-100"
          >
            {data.previewBannerLabel}
          </div>
        )}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,266px)_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* Левая колонка (ещё +10% к 242px): только медиа */}
          <aside className="mx-auto w-full max-w-[300px] lg:mx-0 lg:max-w-none lg:row-start-1 lg:col-start-1">
            <EventMediaStack media={data.media} />
          </aside>

          {/* Основной контент — ширина правой колонки */}
          <div className="min-w-0 lg:row-start-1 lg:col-start-2">
            <EventDecisionPanel
              data={data}
              sessionLine={sessionLineHero}
              venueShort={venueShort}
              onPlan={handlePlan}
              onBuy={handleBuy}
              onSave={handleSave}
            />

            <EventWhyGo items={data.whyGo} />
            <EventFactsGrid facts={data.importantFacts} />
            <EventSessionSelector
              sessions={sessions}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <EventVenueBlock venue={data.venue} />
            <EventAboutSection about={data.about} />
            <EventGoodFit items={data.goodFit} />
            <EventPlanDayCta
              citySlug={data.citySlug}
              nearbyHref={data.planDayLinks?.nearbyHref}
              onPlan={handlePlan}
              onSave={handleSave}
            />
          </div>

          {/* Редакция / цена / бронирование — правая колонка */}
          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            <EventOrganizerNotes note={data.organizerNote} />
            {data.priceDetails && (
              <section className="border-t border-border/40 py-8">
                <h2 className="text-[15px] font-semibold">Детали цены</h2>
                <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
                  {data.priceDetails}
                </p>
              </section>
            )}
            {data.bookingNotes && (
              <section className="border-t border-border/40 py-8">
                <h2 className="text-[15px] font-semibold">Бронирование и вход</h2>
                <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                  {data.bookingNotes}
                </p>
              </section>
            )}
          </div>

          {/* Похожие — в самом низу, на всю ширину шаблона */}
          {hasSimilar && (
            <div className="min-w-0 lg:col-span-2 lg:row-start-3">
              <SimilarEventsSection items={data.similar} onPlan={handlePlanSimilar} />
            </div>
          )}
        </div>
      </div>

      {!data.hidePublicationStats && (
        <PublicationStatsPanel
          entityId={data.id}
          path={`/${data.citySlug}/activity/${data.id}`}
        />
      )}

      <EventStickyActionBar
        sessionLine={sessionLineSticky}
        priceLabel={data.priceLabel}
        primaryLabel={data.cta.planLabel}
        secondaryLabel={data.cta.buyLabel}
        onPrimary={handlePlan}
        onSecondary={handleBuy}
      />
    </div>
  );
}
