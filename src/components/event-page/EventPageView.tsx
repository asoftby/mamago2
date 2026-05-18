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
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { AddToPlanAfterExternalActionPrompt } from "@/features/plan/components/AddToPlanAfterExternalActionPrompt";
import { useDelayedPlanPromptAfterExternalAction } from "@/features/plan/hooks/useDelayedPlanPromptAfterExternalAction";
import { EventRichDescription } from "./EventRichDescription";
import { EventDecisionPanel } from "./EventDecisionPanel";
import { EventMediaStack } from "./EventMediaStack";
import { EventSessionSelector } from "./EventSessionSelector";
import { EventStickyActionBar } from "./EventStickyActionBar";
import { SimilarEventsSection } from "./SimilarEventsSection";
import { EventWhyGo } from "./EventWhyGo";
import { EventGoodFit } from "./EventGoodFit";
import { PublicationStatsPanel } from "@/components/publication-stats";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

/* ── Helpers ──────────────────────────────────────────────── */

function venueOneLine(data: EventPageData): string | undefined {
  const v = data.venue;
  if (!v) return undefined;
  const parts = [v.name, v.address].filter(Boolean);
  return parts.join(" · ");
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
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5">

          {facts.map((f, i) => (
            <div
              key={f.id}
              className={cn(
                "flex flex-col gap-1.5 px-5 py-5",
                i === 0 ? "pl-0" : "border-l border-[rgba(20,18,16,0.10)]",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
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
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[320px_1fr] md:gap-14">
          {/* Left: heading */}
          <div>
            <div className="mb-4 flex items-center gap-3.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                01 — О событии
              </span>
              <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
            </div>
            <h2
              className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,56px)] font-normal leading-[1] tracking-[-0.02em] text-[#141210]"
            >
              Один час,
              <br />
              <span className="italic text-[#C24E22]">один яркий день.</span>
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
    <section className="border-b border-[rgba(20,18,16,0.10)] py-14 md:py-16">
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          {/* Left: text */}
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex items-center gap-3.5">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                04 — Где проходит
              </span>
              <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
            </div>

            <h2
              className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,60px)] font-normal leading-[1.05] tracking-[-0.02em] text-[#141210]"
              style={{ margin: "0 0 20px" }}
            >
              {venue.name},
              <br />
              {venue.landmark ? (
                <span className="italic text-[#C24E22]">{venue.landmark}</span>
              ) : venue.metro ? (
                <span className="italic text-[#C24E22]">в шаге от метро</span>
              ) : null}
            </h2>

            <div className="mb-6 text-[16px] leading-[1.6] text-[#3A332B]">
              {venue.name}
              {venue.address && <><br />{venue.address}</>}
              {venue.district && <><br />{venue.district}</>}
            </div>

            {/* Location tags */}
            {[venue.district, venue.metro, venue.landmark].some(Boolean) && (
              <div className="mb-8 flex flex-wrap gap-2">
                {[venue.district, venue.metro, venue.landmark]
                  .filter(Boolean)
                  .map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex h-8 items-center rounded-full border border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-3.5 text-[13px] text-[#141210]"
                    >
                      ● {tag}
                    </span>
                  ))}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-2.5">
              {(venue.routeUrl ?? venue.mapUrl) && (
                <a
                  href={venue.routeUrl ?? venue.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#141210] px-6 text-[15px] font-semibold text-[#FAF7F1] transition-colors hover:bg-black"
                >
                  Маршрут →
                </a>
              )}
              {venue.placeHref && (
                <a
                  href={venue.placeHref}
                  className="inline-flex h-12 items-center rounded-full border border-[rgba(20,18,16,0.25)] bg-transparent px-6 text-[15px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
                >
                  Страница места
                </a>
              )}
            </div>
          </div>

          {/* Right: map card */}
          {venue.mapUrl && (
            <div
              className="relative overflow-hidden rounded-[24px] border border-[rgba(20,18,16,0.10)] bg-[#E8E0D4]"
              style={{ aspectRatio: "4/3" }}
            >
              <img
                src={venue.mapUrl}
                alt={`Карта: ${venue.name}`}
                className="h-full w-full object-cover"
              />
              {/* Animated pin */}
              <div
                className="ep-pulse absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#E86A3A] shadow-[0_4px_16px_rgba(232,106,58,0.45)]"
                style={{ top: "44%", left: "50%" }}
              >
                <span className="text-[18px] leading-none">📍</span>
              </div>
              {/* Bottom overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-[16px] border border-[rgba(20,18,16,0.08)] bg-[rgba(250,247,241,0.95)] px-4 py-3 backdrop-blur-[10px]">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-snug text-[#141210]">
                    {venue.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[rgba(20,18,16,0.50)]">
                    {venue.address ?? venue.district}
                  </div>
                </div>
                {(venue.routeUrl ?? venue.mapUrl) && (
                  <a
                    href={venue.routeUrl ?? venue.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 shrink-0 items-center rounded-full border border-[rgba(20,18,16,0.18)] px-3.5 text-[12px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
                  >
                    ↗ Маршрут
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
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
}: {
  priceLabel: string;
  buyLabel: string;
  planLabel: string;
  onBuy: () => void;
  onPlan: () => void;
  sessionTargetDate?: string;
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
      <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
        <div className="mx-auto max-w-[900px] text-center">
          {daysLeft !== null && (
            <span className="mb-4 block text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              До события {daysLeft} {dayWord} · {hoursLeft} часов
            </span>
          )}
          <h2
            className="font-[family-name:var(--font-display)] text-[clamp(52px,8vw,120px)] font-normal leading-[0.95] tracking-[-0.025em] text-[#141210]"
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
            <button
              type="button"
              onClick={onBuy}
              className="inline-flex h-16 items-center gap-2 rounded-full bg-[#E86A3A] px-7 text-[17px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
            >
              {buyLabel}&nbsp;{priceLabel} <span aria-hidden>→</span>
            </button>
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
export function EventPageView({ data }: { data: EventPageData }) {
  const { isAuthenticated } = useAuthMe();
  const setPublicationIntent = useSetPublicationIntent();
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPublicationIntent(data.discoveryIntent);
    return () => setPublicationIntent(null);
  }, [data.discoveryIntent, setPublicationIntent]);

  const sessions = data.sessions;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.sessions[0]?.id ?? null,
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
      const iso = new Date(s.startsAt).toISOString().split("T")[0];
      if (iso) set.add(iso);
    }
    return Array.from(set).sort();
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
    };
    if (availablePlanDates.length !== 1) return base;
    return { ...base, eventPlanDateISO: availablePlanDates[0]! };
  }, [availablePlanDates, data.title]);

  const {
    open: externalPlanPromptOpen,
    triggerPrompt: triggerExternalPlanPrompt,
    dismissPrompt: dismissExternalPlanPrompt,
    acceptPrompt: acceptExternalPlanPrompt,
  } = useDelayedPlanPromptAfterExternalAction({
    entityType: "EVENT",
    entityId: data.id,
    isInPlan: saveStatus.inPlan,
    delayMs: 10_000,
    enabled: Boolean(data.cta.purchaseUrl) && !saveModalOpen,
  });

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

  useEffect(() => { void loadSaveStatus(); }, [loadSaveStatus]);
  useEffect(() => {
    if (!saveModalOpen) return;
    void loadSaveStatus();
  }, [saveModalOpen, loadSaveStatus]);

  useEffect(() => {
    if (!externalPlanPromptOpen) return;
    void postAnalyticsEvent({
      eventType: "CARD_VIEW",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: {
        source: "detail",
        section: "afisha",
        targetAction: "plan_prompt",
        eventName: "add_to_plan_prompt_shown",
        placement: "post_external_cta_prompt",
      },
    });
  }, [data.citySlug, data.id, externalPlanPromptOpen]);

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
        }
        await loadSaveStatus();
      } catch {
        toast.error("Не получилось выполнить действие", { description: "Попробуйте еще раз" });
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

  const handleBuy = useCallback((options?: { source?: string; sessionId?: string }) => {
    const placement = options?.source ?? "detail";
    const sessionId = options?.sessionId ?? selectedSession?.id ?? null;

    setIsSecondaryLoading(true);
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: {
        source: "detail",
        section: "afisha",
        targetAction: "buy",
        eventName: "event_ticket_click",
        placement,
        sessionId,
      },
    });

    const purchaseUrl = data.cta.purchaseUrl?.trim();
    if (!purchaseUrl) {
      toast.message(data.cta.buyLabel, {
        description: "Здесь будет ссылка на покупку или сайт организатора.",
      });
      window.setTimeout(() => setIsSecondaryLoading(false), 500);
      return;
    }

    const popup = window.open(purchaseUrl, "_blank", "noopener,noreferrer");
    if (popup) {
      popup.opener = null;
    }
    triggerExternalPlanPrompt();
    window.setTimeout(() => setIsSecondaryLoading(false), 500);
  }, [
    data.citySlug,
    data.cta.buyLabel,
    data.cta.purchaseUrl,
    data.id,
    selectedSession?.id,
    triggerExternalPlanPrompt,
  ]);

  const handleSave = useCallback(() => {
    const was = isFavorite(data.id);
    toggleFavorite(data.id);
    toast.success(was ? "Убрано из идей" : "Сохранено в идеи");
  }, [data.id]);

  const handleExternalPlanPromptDismiss = useCallback(() => {
    dismissExternalPlanPrompt();
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: data.id,
      vertical: "CITY",
      citySlug: data.citySlug,
      meta: {
        source: "detail",
        section: "afisha",
        targetAction: "prompt_dismiss",
        eventName: "add_to_plan_prompt_dismiss",
        placement: "post_external_cta_prompt",
      },
    });
  }, [data.citySlug, data.id, dismissExternalPlanPrompt]);

  const handleExternalPlanPromptAccept = useCallback(() => {
    acceptExternalPlanPrompt();
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
        eventName: "add_to_plan_prompt_accept",
        placement: "post_external_cta_prompt",
      },
    });
    setSaveModalOpen(true);
  }, [acceptExternalPlanPrompt, data.citySlug, data.id]);

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

      {/* Marquee ticker */}
      <EventMarquee items={marqueeItems} />

      {/* ── Hero section ─── */}
      <section className="pt-2 pb-14">
        <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
          {/* Mobile: media above decision panel */}
          <div className="lg:hidden mb-8">
            <EventMediaStack media={data.media} />
          </div>

          {/* Desktop: two-column side-by-side */}
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[320px_1fr] lg:items-start">
            {/* Left: media stack (desktop only — mobile rendered above) */}
            <div className="hidden lg:block">
              <EventMediaStack media={data.media} />
            </div>

            {/* Right: decision panel */}
            <div ref={ctaRef}>
              <EventDecisionPanel
                data={data}
                sessionLine={sessionLineHero}
                sessionTargetDate={selectedSession?.startsAt}
                venueShort={venueShort}
                onPlan={handlePlan}
                onBuy={() => handleBuy({ source: "hero_cta" })}
                onSave={handleSave}
                isPlanned={saveStatus.inPlan}
                planDate={saveStatus.planDate}
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

      {/* ── Why go + Good fit ─── */}
      {(hasWhyGo || hasGoodFit) && (
        <section className="border-b border-[rgba(20,18,16,0.10)] py-14 md:py-16">
          <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
            <div className="mb-8 flex items-center gap-3.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                02 — Что внутри
              </span>
              <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
            </div>
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
              {hasWhyGo && <EventWhyGo items={data.whyGo} />}
              {hasGoodFit && <EventGoodFit items={data.goodFit} />}
            </div>
          </div>
        </section>
      )}

      {/* ── Sessions ─── */}
      {sessions.length > 0 && (
        <section className="border-b border-[rgba(20,18,16,0.10)] py-14 md:py-16">
          <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-3.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                    03 — Расписание и сеансы
                  </span>
                  <span className="h-px w-[120px] bg-[rgba(20,18,16,0.10)]" />
                </div>
                <h2
                  className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,56px)] font-normal leading-[1] tracking-[-0.02em] text-[#141210]"
                >
                  Выбери удобное{" "}
                  <span className="italic text-[#C24E22]">время</span>.
                </h2>
              </div>
              <span className="inline-flex h-7 items-center rounded-full border border-[rgba(20,18,16,0.18)] px-3 text-[13px] text-[#141210]">
                {sessions.length} {sessions.length === 1 ? "сеанс" : "сеансов"}
              </span>
            </div>
            <EventSessionSelector
              sessions={sessions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBuySession={(session) =>
                handleBuy({ source: "session_card", sessionId: session.id })
              }
              onPlanSession={() => handlePlan()}
            />
          </div>
        </section>
      )}

      {/* ── Location ─── */}
      {data.venue && <EventLocationEditorial venue={data.venue} />}

      {/* ── Similar events ─── */}
      {hasSimilar && (
        <section className="border-b border-[rgba(20,18,16,0.10)] py-14 md:py-16">
          <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-7">
            <SimilarEventsSection items={data.similar} onPlan={handlePlanSimilar} />
          </div>
        </section>
      )}

      {/* ── Final CTA ─── */}
      <EventFinalCta
        priceLabel={data.priceLabel}
        buyLabel={data.cta.buyLabel}
        planLabel={data.cta.planLabel}
        onBuy={() => handleBuy({ source: "final_cta" })}
        onPlan={handlePlanDayCta}
        sessionTargetDate={selectedSession?.startsAt}
      />

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
        primaryLabel={
          saveStatus.inPlan
            ? saveStatus.planDate
              ? `В плане на ${formatPlanDateRu(saveStatus.planDate)}`
              : "В плане"
            : data.cta.planLabel
        }
        planDate={saveStatus.planDate}
        secondaryLabel={data.cta.purchaseUrl ? data.cta.buyLabel : undefined}
        isPlanned={saveStatus.inPlan}
        isSaved={saveStatus.isIdea}
        isPrimaryLoading={isPrimaryLoading}
        isSecondaryLoading={isSecondaryLoading}
        onPrimary={handlePlan}
        onSecondary={
          data.cta.purchaseUrl
            ? () => handleBuy({ source: "sticky_bar" })
            : undefined
        }
        onSave={handleSave}
      />

      <AddToPlanAfterExternalActionPrompt
        open={externalPlanPromptOpen}
        onAddToPlan={handleExternalPlanPromptAccept}
        onDismiss={handleExternalPlanPromptDismiss}
        isIdea={saveStatus.isIdea}
      />

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
