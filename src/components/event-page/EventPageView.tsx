"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSetPublicationIntent } from "@/contexts/PublicationIntentContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { formatRuSessionHero } from "@/lib/event/eventPageFormat";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { EventRichDescription } from "./EventRichDescription";
import { EventDecisionPanel } from "./EventDecisionPanel";
import { EventFactsGrid } from "./EventFactsGrid";
import { EventGoodFit } from "./EventGoodFit";
import { EventMediaStack } from "./EventMediaStack";
import { EventPlanDayCta } from "./EventPlanDayCta";
import { EventSessionSelector } from "./EventSessionSelector";
import { EventStickyActionBar } from "./EventStickyActionBar";
import { EventWhyGo } from "./EventWhyGo";
import { SimilarEventsSection } from "./SimilarEventsSection";
import { PublicationStatsPanel } from "@/components/publication-stats";
import { postAnalyticsEvent } from "@/lib/analytics/client";

function venueOneLine(data: EventPageData): string | undefined {
  const v = data.venue;
  if (!v) return undefined;
  const parts = [v.name, v.address].filter(Boolean);
  return parts.join(" · ");
}

export function EventPageView({ data }: { data: EventPageData }) {
  const { isAuthenticated } = useAuthMe();
  const setPublicationIntent = useSetPublicationIntent();
  useEffect(() => {
    setPublicationIntent(data.discoveryIntent);
    return () => setPublicationIntent(null);
  }, [data.discoveryIntent, setPublicationIntent]);

  const sessions = data.sessions;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.sessions[0]?.id ?? null
  );
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [planDateChooserOpen, setPlanDateChooserOpen] = useState(false);
  const [isPrimaryLoading, setIsPrimaryLoading] = useState(false);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    isIdea: boolean;
    inPlan: boolean;
    planDate: string | null;
    planStartsAt: string | null;
  }>({
    isIdea: false,
    inPlan: false,
    planDate: null,
    planStartsAt: null,
  });

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
  const availablePlanDates = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (!s.startsAt) continue;
      const iso = new Date(s.startsAt).toISOString().split("T")[0];
      if (iso) set.add(iso);
    }
    return Array.from(set).sort();
  }, [sessions]);

  const formatPlanDateRu = useCallback((iso: string) => {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, []);

  const loadSaveStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/save/status?activityId=${data.id}`);
      if (!res.ok) return;
      const json = await res.json();
      setSaveStatus({
        isIdea: Boolean(json.isIdea),
        inPlan: Boolean(json.inPlan),
        planDate: json.planDate ?? null,
        planStartsAt: json.planStartsAt ?? null,
      });
    } catch {
      // ignore status errors silently
    }
  }, [data.id]);

  // Загружаем статус при монтировании компонента
  useEffect(() => {
    void loadSaveStatus();
  }, [loadSaveStatus]);

  useEffect(() => {
    if (!saveModalOpen) return;
    void loadSaveStatus();
  }, [saveModalOpen, loadSaveStatus]);

  const handlePlan = useCallback(() => {
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: { 
        source: "detail", 
        section: "afisha", 
        targetAction: "plan",
        isPlanned: saveStatus.inPlan,
      },
    });
    
    // Если уже в плане, открываем модал для управления
    // (можно изменить дату или удалить из плана)
    setSaveModalOpen(true);
  }, [data.citySlug, data.id, saveStatus.inPlan]);

  const handleSaveToPlanConfirm = useCallback(
    async (result: SaveToPlanResult) => {
      setIsPrimaryLoading(true);
      try {
        if (result.action === "plan") {
          const res = await fetch("/api/save/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              activityId: data.id,
              date: result.dateISO,
              title: data.title,
              coverImageUrl: data.media.posterUrl,
            }),
          });
          if (!res.ok) throw new Error("plan_save_failed");
          toast.success("Добавлено в план", {
            description: `Событие добавлено на ${formatPlanDateRu(result.dateISO)}`,
          });
        } else if (result.action === "ideas") {
          const res = await fetch("/api/save/idea", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityId: data.id }),
          });
          if (!res.ok) throw new Error("idea_save_failed");
          toast.success("Сохранено в идеи");
        } else if (result.action === "remove-idea") {
          const res = await fetch(`/api/save/idea?activityId=${data.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("idea_remove_failed");
          toast.success("Убрано из идей");
        }
        await loadSaveStatus();
      } catch (e) {
        toast.error("Не удалось сохранить", {
          description: "Попробуйте еще раз",
        });
        throw e;
      } finally {
        setIsPrimaryLoading(false);
      }
    },
    [data.id, data.media.posterUrl, data.title, formatPlanDateRu, loadSaveStatus],
  );

  const addToPlanByDate = useCallback(
    async (dateISO: string) => {
      try {
        const res = await fetch("/api/save/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityId: data.id,
            date: dateISO,
            title: data.title,
            coverImageUrl: data.media.posterUrl,
          }),
        });
        if (!res.ok) throw new Error("plan_save_failed");
        await loadSaveStatus();
        toast.success("Добавлено в план", {
          description: `Событие добавлено на ${formatPlanDateRu(dateISO)}`,
        });
      } catch {
        toast.error("Не удалось добавить в план", {
          description: "Попробуйте еще раз",
        });
      }
    },
    [data.id, data.media.posterUrl, data.title, formatPlanDateRu, loadSaveStatus],
  );

  const handlePlanDayCta = useCallback(() => {
    if (availablePlanDates.length <= 0) {
      setSaveModalOpen(true);
      return;
    }
    if (availablePlanDates.length === 1) {
      void addToPlanByDate(availablePlanDates[0]!);
      return;
    }
    setPlanDateChooserOpen(true);
  }, [addToPlanByDate, availablePlanDates]);

  const handleBuy = useCallback(() => {
    setIsSecondaryLoading(true);
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: { source: "detail", section: "afisha", targetAction: "buy" },
    });
    
    // TODO: В будущем здесь будет переход на внешний URL или внутренний booking flow
    toast.message(data.cta.buyLabel, {
      description: "Здесь будет ссылка на покупку или сайт организатора.",
    });
    
    setTimeout(() => setIsSecondaryLoading(false), 500);
  }, [data.citySlug, data.cta.buyLabel, data.id]);

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
      {/* Используем ту же ширину, что и хедер: max-w-[1200px] px-4 sm:px-6 lg:px-8 */}
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
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
            <EventRichDescription
              htmlContent={data.about.descriptionHtml || ""}
              plainTextSummary={data.about.summary}
              collapsedHeight={120}
            />
            <EventGoodFit items={data.goodFit} />
            <EventPlanDayCta
              citySlug={data.citySlug}
              nearbyHref={data.planDayLinks?.nearbyHref}
              onPlan={handlePlanDayCta}
              onSave={handleSave}
            />
          </div>

          {/* Редакция / цена / бронирование — правая колонка */}
          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            {data.priceDetails && (
              <section className="border-t border-border/40 py-8">
                <h2 className="text-[15px] font-semibold">Детали цены</h2>
                <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
                  {data.priceDetails}
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
          path={publicActivityPath(data.id, data.citySlug, data.slug)}
        />
      )}

      <EventStickyActionBar
        sessionLine={sessionLineSticky}
        priceLabel={data.priceLabel}
        primaryLabel={
          saveStatus.inPlan
            ? saveStatus.planDate
              ? `В плане на ${formatPlanDateRu(saveStatus.planDate)}`
              : "В плане"
            : data.cta.planLabel
        }
        secondaryLabel={data.cta.buyLabel}
        isPlanned={saveStatus.inPlan}
        isPrimaryLoading={isPrimaryLoading}
        isSecondaryLoading={isSecondaryLoading}
        onPrimary={handlePlan}
        onSecondary={handleBuy}
      />
      <SaveActivityFlowAdaptive
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        isAuthenticated={isAuthenticated}
        scenario={{ kind: "quickdate", title: data.title }}
        onPersist={handleSaveToPlanConfirm}
        isIdea={saveStatus.isIdea}
        inPlan={saveStatus.inPlan}
        planDate={saveStatus.planDate}
        planStartsAt={saveStatus.planStartsAt}
      />
      <Dialog open={planDateChooserOpen} onOpenChange={setPlanDateChooserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Выберите дату проведения</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {availablePlanDates.map((iso) => (
              <Button
                key={iso}
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  void addToPlanByDate(iso);
                  setPlanDateChooserOpen(false);
                }}
              >
                {formatPlanDateRu(iso)}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
