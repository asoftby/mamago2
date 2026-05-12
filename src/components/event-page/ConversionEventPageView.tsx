"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSetPublicationIntent } from "@/contexts/PublicationIntentContext";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { PublicationStatsPanel } from "@/components/publication-stats";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { extractPlainTextLinesFromHtml } from "@/lib/richtext/utils";

// Новые конверсионные блоки
import { EventHighlights } from "./EventHighlights";
import { EventProgram } from "./EventProgram";
import { EventAudience } from "./EventAudience";
import { EventIncludes } from "./EventIncludes";
import { EventLocation } from "./EventLocation";
import { EventRichDescription } from "./EventRichDescription";
import { EventStickyActionBar } from "./EventStickyActionBar";
import { EventSessionSelector } from "./EventSessionSelector";

/**
 * Конверсионная страница события (mamaGo 2.0).
 * 
 * Цель: помочь пользователю быстро принять решение "идём / не идём"
 * и сразу запланировать или купить.
 * 
 * Это decision page + action page, а не просто контентная страница.
 * 
 * Отвечает на 3 вопроса за первые 5-7 секунд:
 * 1) Что это за событие?
 * 2) Почему мне туда идти?
 * 3) Подходит ли это мне / моему ребёнку?
 */
export function ConversionEventPageView({ data }: { data: EventPageData }) {
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

  const sessionLineSticky = selectedSession
    ? new Date(selectedSession.startsAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : undefined;

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

  const saveQuickdateScenario = useMemo(() => {
    const base = {
      kind: "quickdate" as const,
      title: data.title,
      eventPlanDateOptions: availablePlanDates,
    };
    if (availablePlanDates.length !== 1) return base;
    return { ...base, eventPlanDateISO: availablePlanDates[0]! };
  }, [availablePlanDates, data.title]);

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
      // ignore
    }
  }, [data.id]);

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
        toast.error("Не получилось выполнить действие", {
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
        toast.error("Не получилось выполнить действие", {
          description: "Попробуйте еще раз",
        });
      }
    },
    [data.id, data.media.posterUrl, data.title, formatPlanDateRu, loadSaveStatus],
  );

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

    // TODO: переход на внешний URL или внутренний booking flow
    toast.message(data.cta.buyLabel, {
      description: "Здесь будет ссылка на покупку или сайт организатора.",
    });

    setTimeout(() => setIsSecondaryLoading(false), 500);
  }, [data.citySlug, data.cta.buyLabel, data.id]);

  // Подготовка данных для блоков
  const programSteps = useMemo(() => {
    // TODO: в будущем это будет приходить из данных
    // Пока используем заглушку на основе about.highlights
    if (!data.about.highlights || data.about.highlights.length === 0) {
      return [];
    }
    return data.about.highlights.map((highlight, idx) => ({
      id: `step-${idx}`,
      title: highlight,
      description: undefined,
      duration: undefined,
    }));
  }, [data.about.highlights]);

  const includesItems = useMemo(() => {
    // TODO: в будущем это будет отдельное поле в данных
    // Пока используем priceDetails или bookingNotes
    if (data.priceDetails) {
      return extractPlainTextLinesFromHtml(data.priceDetails);
    }
    return [];
  }, [data.priceDetails]);

  return (
    <div className="min-h-screen bg-background pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-28">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        {/* Preview banner (если есть) */}
        {data.previewBannerLabel && (
          <div
            role="status"
            className="mb-6 flex items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-center text-[14px] font-medium text-amber-950 dark:text-amber-100"
          >
            {data.previewBannerLabel}
          </div>
        )}

        {/* 2-колоночный layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-12">
          {/* ЛЕВАЯ КОЛОНКА: Медиа (sticky) */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="space-y-4">
              {/* Основное изображение */}
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-neutral-100 shadow-lg">
                <img
                  src={data.media.posterUrl}
                  alt={data.media.posterAlt}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Трейлер (если есть) */}
              {data.media.trailerYoutubeId && (
                <button
                  type="button"
                  className="group relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 shadow-md transition-all hover:shadow-lg"
                >
                  <img
                    src={data.media.posterUrl}
                    alt="Трейлер"
                    className="h-full w-full object-cover opacity-60 grayscale transition-all group-hover:opacity-80 group-hover:grayscale-0"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform group-hover:scale-110">
                      <svg
                        className="ml-1 h-8 w-8 text-primary"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 text-xs font-bold uppercase tracking-wider text-white">
                    {data.media.trailerLabel || "Смотреть трейлер"}
                  </div>
                </button>
              )}

              {/* Reels (если есть) */}
              {data.media.reel && (
                <button
                  type="button"
                  className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-accent/30 transition-all hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <svg
                      className="h-12 w-12 text-muted-foreground transition-colors group-hover:text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                      {data.media.reel.label}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </aside>

          {/* ПРАВАЯ КОЛОНКА: Весь контент */}
          <div className="min-w-0">
            {/* Заголовок и мета-информация */}
            <div className="mb-8 space-y-4">
              <h1 className="font-headline text-3xl font-bold leading-tight tracking-tight text-foreground lg:text-4xl">
                {data.title}
              </h1>

              {/* Quick Facts (чипы) */}
              {data.factChips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.factChips.map((chip) => (
                    <div
                      key={chip.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-[13px] font-medium text-foreground"
                    >
                      {chip.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Рейтинг и локация */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 fill-primary text-primary"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span className="font-semibold text-foreground">4.9</span>
                  <span className="text-muted-foreground">(127 отзывов)</span>
                </div>
                {data.venue && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{data.venue.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Выбор сессии (если несколько дат) */}
            {sessions.length > 1 && (
              <div className="mb-8">
                <EventSessionSelector
                  sessions={sessions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            )}

            {/* Что вас ждёт */}
            <EventHighlights items={data.whyGo} />

            {/* Как проходит */}
            {programSteps.length > 0 && <EventProgram steps={programSteps} />}

            {/* Для кого это */}
            <EventAudience items={data.goodFit} />

            {/* Что включено */}
            {includesItems.length > 0 && <EventIncludes items={includesItems} />}

            {/* Где проходит */}
            {data.venue && <EventLocation venue={data.venue} />}

            {/* Полное описание */}
            <EventRichDescription
              htmlContent={data.about.descriptionHtml || ""}
            />
          </div>
        </div>

        {/* Похожие события на всю ширину */}
        {data.similar.length > 0 && (
          <div className="mt-16 border-t border-border/40 pt-10">
            <h2 className="mb-8 font-headline text-2xl font-bold text-foreground">
              Похожие события
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.similar.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-background transition-all hover:border-border hover:shadow-lg"
                >
                  {/* Изображение */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  {/* Информация */}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                      {item.title}
                    </h3>
                    {item.dateLabel && (
                      <p className="text-[13px] text-muted-foreground">
                        {item.dateLabel}
                      </p>
                    )}
                    {item.priceLabel && (
                      <p className="mt-auto text-[14px] font-semibold text-foreground">
                        {item.priceLabel}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Publication stats (если не скрыто) */}
      {!data.hidePublicationStats && (
        <PublicationStatsPanel
          entityId={data.id}
          path={publicActivityPath(data.id, data.citySlug, data.slug)}
        />
      )}

      {/* Sticky Action Bar */}
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

      {/* Модалы */}
      <SaveActivityFlowAdaptive
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        isAuthenticated={isAuthenticated}
        scenario={saveQuickdateScenario}
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
