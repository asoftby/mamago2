"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { formatRuSessionHero } from "@/lib/event/eventPageFormat";
import { formatHHMM } from "@/lib/formatters/date";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { shouldFetchOwnSaveStatus, shouldRefetchAfterFlowClose } from "@/features/save/saveStatusFetchGuard";
import { LocationBlock } from "@/components/shared/LocationBlock";
import { EventRichDescription } from "./EventRichDescription";
import { EventDecisionPanel } from "./EventDecisionPanel";
import { EventSessionSelector } from "./EventSessionSelector";
import { EventStickyActionBar } from "./EventStickyActionBar";
import { EventSimpleBookingModal } from "./EventSimpleBookingModal";
import { DirectRequestCta } from "@/components/direct/DirectRequestCta";
import { SimilarEventsSection } from "./SimilarEventsSection";
import { FaqSection } from "@/components/public/FaqSection";
import { EventWhyGo } from "./EventWhyGo";
import { EventGoodFit } from "./EventGoodFit";
import { PublicationMediaColumn } from "@/components/media/PublicationMediaColumn";
import { PublicationStatsPanel } from "@/components/publication-stats";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { getCityHomeHref } from "@/lib/header/getCityHomeHref";
import { cn } from "@/lib/utils";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { useUpcomingSessions } from "./useUpcomingSessions";

/* ── Helpers ──────────────────────────────────────────────── */

function venueOneLine(data: EventPageData): string | undefined {
  const v = data.venue;
  if (!v) return undefined;
  const parts = [v.name, v.address].filter(Boolean);
  return parts.join(" · ");
}

function pluralizeRu(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count);
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function formatSessionCount(count: number): string {
  return `${count} ${pluralizeRu(count, ["сеанс", "сеанса", "сеансов"])}`;
}

/* ── Marquee ticker ───────────────────────────────────────── */
function EventMarquee({ items }: { items: string[] }) {
  const row = [...items, ...items, ...items];
  return (
    <div
      className="overflow-hidden border-b border-[rgba(255,255,255,0.06)]"
      style={{ background: "#141210", color: "#FAF7F1" }}
    >
      <div
        className="ep-marquee-track flex whitespace-nowrap py-2.5"
        style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {row.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-[18px] px-[18px]">
            <span style={{ opacity: 0.55 }}>{t}</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E86A3A]" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Meta strip ───────────────────────────────────────────── */
function EventMetaStrip({ facts }: { facts: EventPageData["importantFacts"] }) {
  if (!facts.length) return null;
  return (
    <section className="border-y border-[rgba(20,18,16,0.10)]">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div
          className="grid grid-cols-2 md:grid-cols-4"
        >

          {facts.map((f, i) => (
            <div
              key={f.id}
              className={cn(
                "flex flex-col gap-1.5 py-5",
                // мобиле: левая граница у правых ячеек (i нечётное)
                i % 2 !== 0 ? "border-l border-[rgba(20,18,16,0.10)] px-4" : "pr-4",
                // мобиле: нижняя граница у первого ряда
                i < 2 && "border-b border-[rgba(20,18,16,0.10)] md:border-b-0",
                // десктоп: левая граница у всех кроме первого, убираем мобильный паттерн
                i > 0 && "md:border-l md:border-[rgba(20,18,16,0.10)] md:px-5",
                i === 0 && "md:pr-5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                  {f.label}
                </span>
                <span className="font-mono text-[11px] text-[rgba(20,18,16,0.55)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="text-[17px] font-medium leading-snug tracking-[-0.01em] text-[#141210]">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── About section ────────────────────────────────────────── */
function EventAboutEditorial({
  about,
  descriptionHtml,
}: {
  about: EventPageData["about"];
  descriptionHtml?: string;
}) {
  return (
    <section className="border-b border-[rgba(20,18,16,0.10)] py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[320px_1fr] md:gap-14">
          {/* Left: heading */}
          <div>
            <div className="mb-4 flex items-center gap-3.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                О событии
              </span>
              <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
            </div>
            <h2
              style={{ fontSize: 30, fontWeight: 400, lineHeight: 1.3, letterSpacing: "-0.02em", color: "#141210" }}
            >
              <span style={{ fontFamily: "var(--font-sans)" }}>Описание </span><span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", color: "var(--primary)" }}>события</span>
            </h2>
          </div>

          {/* Right: description + chips */}
          <div>
            {descriptionHtml ? (
              <EventRichDescription
                htmlContent={descriptionHtml}
                className="border-t-0 pt-0"
              />
            ) : about.summary ? (
              <p className="text-[20px] leading-[1.5] tracking-[-0.005em] text-[#141210]">
                {about.summary}
              </p>
            ) : null}

            {/* Chip tags from highlights */}
            {about.highlights && about.highlights.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2.5">
                {about.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="inline-flex h-7 items-center rounded-full border border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-3 text-[13px] text-[#141210]"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Location section ─────────────────────────────────────── */
function EventLocationEditorial({ venue }: { venue: NonNullable<EventPageData["venue"]> }) {
  return (
    <LocationBlock
      name={venue.name}
      logoUrl={venue.logoUrl}
      tagline={venue.landmark}
      address={venue.address}
      district={venue.district}
      metro={venue.metro}
      lat={venue.lat}
      lng={venue.lng}
      mapUrl={venue.mapUrl}
      routeUrl={venue.routeUrl}
      placeHref={venue.placeHref}
      className="border-b"
    />
  );
}

/* ── Final CTA section ────────────────────────────────────── */
function EventFinalCta({
  priceLabel,
  buyLabel,
  planLabel,
  onBuy,
  onPlan,
  sessionTargetDate,
  purchaseUrl,
}: {
  priceLabel: string;
  buyLabel: string;
  planLabel: string;
  onBuy: () => void;
  onPlan: () => void;
  sessionTargetDate?: string;
  purchaseUrl?: string;
}) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionTargetDate) return;
    const update = () => {
      const ms = Math.max(0, new Date(sessionTargetDate).getTime() - Date.now());
      setDaysLeft(Math.floor(ms / 86_400_000));
      setHoursLeft(Math.floor((ms % 86_400_000) / 3_600_000));
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [sessionTargetDate]);

  const dayWord =
    daysLeft === 1 ? "день" : daysLeft !== null && daysLeft < 5 ? "дня" : "дней";

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[900px] text-center">
          {daysLeft !== null && (
            <span className="mb-4 block text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              До события {daysLeft} {dayWord} · {hoursLeft} часов
            </span>
          )}
          <h2
            className="font-sans text-[clamp(52px,8vw,120px)] font-semibold leading-[0.95] tracking-[-0.025em] text-[#141210]"
          >
            Не пропустите
            <br />
            это{" "}
            <span className="italic text-[#C24E22]">событие</span>.
          </h2>
          <p className="mx-auto mt-6 max-w-[520px] text-[19px] leading-[1.5] text-[#3A332B]">
            Купите билет за&nbsp;2&nbsp;минуты или отложите в&nbsp;план — мы&nbsp;напомним вечером накануне.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {purchaseUrl && (
              <a
                href={purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onBuy}
                className="inline-flex h-16 items-center gap-2 rounded-full bg-[#E86A3A] px-7 text-[17px] font-semibold text-white transition-colors hover:bg-primary-hover active:translate-y-px"
              >
                {buyLabel}&nbsp;{renderCurrencyText(normalizeUiCurrencyText(priceLabel), { iconSize: "sm" })} <span aria-hidden>→</span>
              </a>
            )}
            <button
              type="button"
              onClick={onPlan}
              className="inline-flex h-16 items-center rounded-full border border-[rgba(20,18,16,0.18)] px-7 text-[15px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
            >
              {planLabel}
            </button>
          </div>
          <p className="mt-5 text-[13px] text-[rgba(20,18,16,0.55)]">
            Билет приходит на e-mail · вход за&nbsp;30&nbsp;минут до&nbsp;начала
          </p>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main EventPageView
══════════════════════════════════════════════════════════════ */
export interface EventDirectCtaInfo {
  activityId: string;
  publicationTitle: string;
  brandName: string;
}

export function EventPageView({
  data,
  direct,
}: {
  data: EventPageData;
  /** Direct "Отправить заявку" CTA — omitted when the event has no resolvable owning Business (rule 5). */
  direct?: EventDirectCtaInfo;
}) {
  const { isAuthenticated } = useAuthMe();
  const setPublicationIntent = useSetPublicationIntent();
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPublicationIntent(data.discoveryIntent);
    return () => setPublicationIntent(null);
  }, [data.discoveryIntent, setPublicationIntent]);

  const sessions = useUpcomingSessions(data.sessions);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.sessions[0]?.id ?? null,
  );

  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && sessions.some((s) => s.id === prev)) return prev;
      return sessions[0]?.id ?? null;
    });
  }, [sessions]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [planDateChooserOpen, setPlanDateChooserOpen] = useState(false);
  const [isPrimaryLoading, setIsPrimaryLoading] = useState(false);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const hasOpenedSaveModalOnceRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<{
    isIdea: boolean;
    inPlan: boolean;
    planDate: string | null;
    planStartsAt: string | null;
    planItemId: string | null;
  }>({
    isIdea: false,
    inPlan: false,
    planDate: null,
    planStartsAt: null,
    planItemId: null,
  });

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? sessions[0],
    [sessions, selectedId],
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
      const iso = getLocalDateKey(new Date(s.startsAt));
      if (iso) set.add(iso);
    }
    return Array.from(set).sort();
  }, [sessions]);

  // Group sessions by date: { "YYYY-MM-DD": [{ id, time: "HH:mm" }, ...] }
  // This is the single source of truth for both time chips and session count dots.
  const planSessionsByDate = useMemo(() => {
    const map: Record<string, Array<{ id: string; time: string }>> = {};
    for (const session of sessions) {
      if (!session.startsAt) continue;
      const d = new Date(session.startsAt);
      const iso = getLocalDateKey(d);
      const time = formatHHMM(d);
      if (!map[iso]) map[iso] = [];
      map[iso].push({ id: session.id, time });
    }
    return map;
  }, [sessions]);

  const formatPlanDateRu = useCallback(
    (iso: string) =>
      new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );

  const saveQuickdateScenario = useMemo(() => {
    const base = {
      kind: "quickdate" as const,
      title: data.title,
      eventPlanDateOptions: availablePlanDates,
      eventPlanSessionsByDate: planSessionsByDate,
    };
    if (availablePlanDates.length !== 1) return base;
    return { ...base, eventPlanDateISO: availablePlanDates[0]! };
  }, [availablePlanDates, data.title, planSessionsByDate]);

  const loadSaveStatus = useCallback(async () => {
    if (!shouldFetchOwnSaveStatus(isAuthenticated)) {
      setSaveStatus({
        isIdea: false,
        inPlan: false,
        planDate: null,
        planStartsAt: null,
        planItemId: null,
      });
      return;
    }
    try {
      const res = await fetch(`/api/save/status?activityId=${data.id}`);
      if (!res.ok) return;
      const json = await res.json();
      setSaveStatus({
        isIdea: Boolean(json.isIdea),
        inPlan: Boolean(json.inPlan),
        planDate: json.planDate ?? null,
        planStartsAt: json.planStartsAt ?? null,
        planItemId: json.planItemId ?? null,
      });
    } catch {
      // ignore
    }
  }, [data.id, isAuthenticated]);

  useEffect(() => { void loadSaveStatus(); }, [loadSaveStatus]);
  // Статус обновляется только после закрытия модалки, и только если пользователь
  // реально открывал её — эффект выше уже загрузил статус на монтировании,
  // без этой проверки здесь случился бы дублирующийся GET сразу на первом рендере.
  useEffect(() => {
    if (saveModalOpen) {
      hasOpenedSaveModalOnceRef.current = true;
      return;
    }
    if (!shouldRefetchAfterFlowClose({ flowOpen: saveModalOpen, hasOpenedOnce: hasOpenedSaveModalOnceRef.current })) return;
    void loadSaveStatus();
  }, [saveModalOpen, loadSaveStatus]);

  const handlePlan = useCallback(() => {
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: { source: "detail", section: "afisha", targetAction: "plan", isPlanned: saveStatus.inPlan },
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
              activitySessionId: result.timeSlotId ?? null,
              title: data.title,
              coverImageUrl: data.media.posterUrl,
            }),
          });
          if (!res.ok) throw new Error("plan_save_failed");
          toast.success("Добавлено в план", {
            description: `Событие добавлено на ${formatPlanDateRu(result.dateISO)}`,
          });
          requestPlanRefetchForDate(result.dateISO);
        } else if (result.action === "ideas") {
          const res = await fetch("/api/save/idea", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityId: data.id }),
          });
          if (!res.ok) throw new Error("idea_save_failed");
          toast.success("Сохранено в идеи");
        } else if (result.action === "remove-idea") {
          const res = await fetch(`/api/save/idea?activityId=${data.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("idea_remove_failed");
          toast.success("Убрано из идей");
        } else if (result.action === "remove-plan") {
          const res = await fetch(`/api/save/plan?planItemId=${result.planItemId}`, { method: "DELETE" });
          if (!res.ok) throw new Error("plan_remove_failed");
          toast.success("Убрано из плана");
        }
        // loadSaveStatus вызывается через useEffect когда saveModalOpen=false —
        // после закрытия модалки, без перерисовки пока она ещё открыта.
      } catch {
        toast.error("Не получилось выполнить действие", { description: "Попробуйте еще раз" });
      } finally {
        setIsPrimaryLoading(false);
      }
    },
    [data.id, data.media.posterUrl, data.title, formatPlanDateRu],
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
        requestPlanRefetchForDate(dateISO);
        toast.success("Добавлено в план", {
          description: `Событие добавлено на ${formatPlanDateRu(dateISO)}`,
        });
      } catch {
        toast.error("Не получилось выполнить действие", { description: "Попробуйте еще раз" });
      }
    },
    [data.id, data.media.posterUrl, data.title, formatPlanDateRu, loadSaveStatus],
  );

  const handleBuy = useCallback(() => {
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: { source: "detail", section: "afisha", targetAction: "buy" },
    });
  }, [data.citySlug, data.id]);

  const handleSave = useCallback(() => {
    const was = isFavorite(data.id);
    toggleFavorite(data.id);
    toast.success(was ? "Убрано из идей" : "Сохранено в идеи");
  }, [data.id]);

  const handlePlanSimilar = useCallback((id: string) => {
    toggleFavorite(id);
    toast.success("В план", { description: `Событие ${id} — заглушка действия.` });
  }, []);

  const handlePlanDayCta = useCallback(() => {
    if (availablePlanDates.length <= 1) {
      setSaveModalOpen(true);
      return;
    }
    setPlanDateChooserOpen(true);
  }, [availablePlanDates]);

  const hasPurchaseUrl = Boolean(data.cta.purchaseUrl);
  const hasSimpleBooking = Boolean(data.cta.simpleBooking);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const handleBook = useCallback(() => setBookingModalOpen(true), []);
  const hasSimilar = data.similar.length > 0;
  const hasWhyGo = data.whyGo.length > 0;
  const hasGoodFit = data.goodFit.length > 0;

  /* Marquee items built from available data */
  const marqueeItems = useMemo(() => {
    const items: string[] = [];
    if (sessionLineHero) items.push(sessionLineHero);
    if (data.venue?.name) items.push(data.venue.name);
    if (data.priceLabel) items.push(data.priceLabel);
    if (data.venue?.metro) items.push(data.venue.metro);
    items.push("Билет приходит на e-mail");
    return items;
  }, [sessionLineHero, data.venue, data.priceLabel]);

  return (
    <div
      className="ep-surface min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"
    >
      {/* Preview banner */}
      {data.previewBannerLabel && (
        <div
          role="status"
          className="flex items-center justify-center border-b border-amber-500/35 bg-amber-500/10 px-4 py-3 text-center text-[14px] font-medium text-amber-950"
        >
          {data.previewBannerLabel}
        </div>
      )}


      {/* ── Hero section ─── */}
      <section className="pt-12 pb-14">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mb-4 md:mb-0">
            <MobileSmartBackButton fallbackHref={getCityHomeHref(data.citySlug)} />
          </div>

          {/* Mobile: media above decision panel */}
          <div className="lg:hidden mb-8">
            <PublicationMediaColumn
              media={data.media}
              galleryItems={data.galleryItems}
            />
          </div>

          {/* Desktop: two-column side-by-side (media left, decision panel right) */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[440px_1fr] lg:gap-14 lg:items-start">
            {/* Left: media stack + gallery strip (desktop only — mobile rendered above) */}
            <div className="hidden lg:block">
              <PublicationMediaColumn
                media={data.media}
                galleryItems={data.galleryItems}
              />
            </div>

            {/* Right: decision panel */}
            <div ref={ctaRef}>
              <EventDecisionPanel
                data={data}
                sessionLine={sessionLineHero}
                sessionTargetDate={selectedSession?.startsAt}
                venueShort={venueShort}
                onPlan={handlePlan}
                onBuy={handleBuy}
                onSave={handleSave}
                isPlanned={saveStatus.inPlan}
                planDate={saveStatus.planDate}
                directSlot={
                  direct && (
                    <DirectRequestCta
                      publicationRef={{ publicationType: "EVENT", activityId: direct.activityId }}
                      publicationTitle={direct.publicationTitle}
                      brandName={direct.brandName}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-[rgba(20,18,16,0.18)] bg-transparent text-[15px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
                    >
                      Отправить заявку
                    </DirectRequestCta>
                  )
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Meta strip ─── */}
      {data.importantFacts.length > 0 && (
        <EventMetaStrip facts={data.importantFacts} />
      )}

      {/* ── About ─── */}
      <EventAboutEditorial
        about={data.about}
        descriptionHtml={data.about.descriptionHtml}
      />

      <FaqSection items={data.faqItems} />


      {/* ── Sessions ─── */}
      {sessions.length > 0 && (
        <section className="border-b border-[rgba(20,18,16,0.10)] py-14 md:py-16">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-3.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                    Расписание и сеансы
                  </span>
                  <span className="h-px w-[120px] bg-[rgba(20,18,16,0.10)]" />
                </div>
                <h2
                  style={{ fontSize: 30, fontWeight: 400, lineHeight: 1.3, letterSpacing: "-0.02em", color: "#141210" }}
                >
                  <span style={{ fontFamily: "var(--font-sans)" }}>Выбери </span><span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", color: "var(--primary)" }}>удобное время.</span>
                </h2>
              </div>
              <span className="inline-flex h-7 items-center rounded-full border border-[rgba(20,18,16,0.18)] px-3 text-[13px] text-[#141210]" style={{ fontFamily: "Menlo, monospace" }}>
                {formatSessionCount(sessions.length)}
              </span>
            </div>
            <EventSessionSelector
              sessions={sessions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPlan={handlePlan}
              onBook={hasSimpleBooking ? handleBook : undefined}
              isPlanned={saveStatus.inPlan}
              priceLabel={data.priceLabel}
              purchaseUrl={data.cta.purchaseUrl}
              buyLabel={data.cta.buyLabel}
            />
          </div>
        </section>
      )}

      {/* ── Location ─── */}
      {data.venue && <EventLocationEditorial venue={data.venue} />}

      {/* ── Similar events ─── */}
      {hasSimilar && (
        <section className="border-b border-[rgba(20,18,16,0.10)] py-14 md:py-16">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <SimilarEventsSection items={data.similar} onPlan={handlePlanSimilar} />
          </div>
        </section>
      )}

      {/* Publication stats */}
      {!data.hidePublicationStats && (
        <PublicationStatsPanel
          entityId={data.id}
          path={publicActivityPath(data.id, data.citySlug, data.slug)}
        />
      )}

      {/* ── Top sticky bar (desktop scroll) ─── */}
      <EventStickyActionBar
        ctaRef={ctaRef}
        sessionLine={sessionLineSticky}
        priceLabel={data.priceLabel}
        primaryLabel={data.cta.buyLabel}
        primaryHref={data.cta.purchaseUrl}
        isPlanned={saveStatus.inPlan}
        isPrimaryLoading={isPrimaryLoading}
        isPlanLoading={isSecondaryLoading}
        onPrimary={handleBuy}
        onBook={hasSimpleBooking ? handleBook : undefined}
        onPlan={handlePlan}
        hasPurchaseUrl={hasPurchaseUrl}
      />

      {data.cta.simpleBooking && (
        <EventSimpleBookingModal
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          eventTitle={data.title}
          eventCategory={data.categoryLabel}
          priceLabel={data.priceLabel}
          booking={data.cta.simpleBooking}
        />
      )}

      {/* Save flow modal */}
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
        planItemId={saveStatus.planItemId}
      />

      {/* Date chooser (multiple sessions) */}
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
