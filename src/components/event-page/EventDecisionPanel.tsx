"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { EventBreadcrumbs } from "./EventBreadcrumbs";
import { OwnerEditDropdown } from "./OwnerEditDropdown";

type EventDecisionPanelProps = {
  data: Pick<
    EventPageData,
    | "id"
    | "breadcrumbs"
    | "ageFromBadge"
    | "categoryLabel"
    | "title"
    | "subtitle"
    | "factChips"
    | "priceLabel"
    | "venue"
    | "cta"
    | "ownerEditHref"
  >;
  sessionLine?: string;
  /** ISO date-time of next session — used for countdown. */
  sessionTargetDate?: string;
  venueShort?: string;
  onPlan: () => void;
  onBuy: () => void;
  onSave: () => void;
  isPlanned?: boolean;
  planDate?: string | null;
  className?: string;
  previewRegionClassName?: Partial<
    Record<"hero" | "venue" | "schedule" | "pricing", string | undefined>
  >;
};

/** Split title: first word roman, rest italic-accent. */
function splitTitle(title: string): { head: string; tail: string } {
  const t = title.trim();
  const idx = t.indexOf(" ");
  if (idx === -1) return { head: t, tail: "" };
  return { head: t.slice(0, idx), tail: t.slice(idx + 1) };
}

/** Countdown hook — returns d/h/m/s refreshed every second. */
function useCountdown(targetIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetIso) return null;
  const ms = Math.max(0, new Date(targetIso).getTime() - now);
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1_000),
    done: ms === 0,
  };
}

export function EventDecisionPanel({
  data,
  sessionLine,
  sessionTargetDate,
  venueShort,
  onPlan,
  onBuy,
  onSave,
  isPlanned = false,
  planDate,
  className,
  previewRegionClassName: pr,
}: EventDecisionPanelProps) {
  const revealRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const cd = useCountdown(sessionTargetDate);

  /* Reveal animations */
  useEffect(() => {
    const targets = [revealRef.current, subtitleRef.current].filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const { head, tail } = splitTitle(data.title);

  const planLabel = isPlanned
    ? planDate
      ? `В плане на ${new Date(`${planDate}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}`
      : "В плане ✓"
    : data.cta.planLabel;

  const venueName = data.venue?.name ?? venueShort;
  const venueAddress = data.venue?.address;
  const venueMetro = data.venue?.metro;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Breadcrumbs */}
      <EventBreadcrumbs
        items={data.breadcrumbs}
        className="text-[13px] text-[rgba(20,18,16,0.55)]"
      />

      {/* Kicker: category pill + age + format caps */}
      <div
        ref={revealRef}
        className={cn(
          "ep-reveal flex flex-wrap items-center gap-2.5",
          pr?.hero,
        )}
      >
        {data.categoryLabel && (
          <span className="inline-flex h-7 items-center rounded-full bg-[#FFE8DC] px-3 text-[12px] font-semibold text-[#C24E22]">
            ● {data.categoryLabel}
          </span>
        )}
        {data.ageFromBadge && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            {data.ageFromBadge}
          </span>
        )}
        {/* Show first factChip as format */}
        {data.factChips[0] && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            {data.factChips[0].label}
          </span>
        )}
      </div>

      {/* Editorial display title */}
      <h1
        className="font-sans text-[clamp(40px,6vw,80px)] font-semibold leading-[0.95] tracking-[-0.025em] text-[#141210]"
        style={{ margin: 0 }}
      >
        {head}
        {tail && (
          <>
            <br />
            <span className="italic text-[#C24E22]">{tail}</span>
          </>
        )}
      </h1>

      {/* Subtitle */}
      {data.subtitle && (
        <div
          ref={subtitleRef}
          className="ep-reveal max-w-[600px] text-[18px] leading-[1.5] text-[#3A332B]"
        >
          {data.subtitle}
        </div>
      )}

      {/* Decision sticky card */}
      <div
        className={cn(
          "rounded-[18px] border border-[rgba(20,18,16,0.10)] bg-[#FAF7F1] p-6",
          "shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_30px_60px_-30px_rgba(20,18,16,0.18)]",
          "lg:sticky lg:top-6",
        )}
      >
        {/* Session + Price row */}
        <div
          className={cn(
            "mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(20,18,16,0.10)] pb-5",
            pr?.schedule,
          )}
        >
          {/* Next session */}
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              Ближайший сеанс
            </div>
            {sessionLine ? (
              <div className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[#141210]">
                {sessionLine}
              </div>
            ) : (
              <div className="text-[15px] text-[rgba(20,18,16,0.55)]">Расписание уточняется</div>
            )}
          </div>

          {/* Price */}
          <div className={cn("text-right", pr?.pricing)}>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
              Стоимость
            </div>
            <div className="font-sans text-[48px] font-semibold leading-[1] tracking-[-0.02em] text-[#141210]">
              {data.priceLabel}
            </div>
          </div>
        </div>

        {/* Venue row */}
        {(venueName || venueAddress) && (
          <div className={cn("mb-5 flex items-start gap-3 text-[14px]", pr?.venue)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFE8DC] text-[15px]">
              📍
            </span>
            <div className="min-w-0">
              {venueName && (
                <div className="font-semibold leading-snug text-[#141210]">{venueName}</div>
              )}
              {venueAddress && (
                <div className="mt-0.5 text-[13px] text-[rgba(20,18,16,0.55)]">
                  {venueAddress}
                </div>
              )}
              {venueMetro && (
                <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#C24E22]">
                  ● {venueMetro}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Countdown */}
        {cd && !cd.done && (
          <div
            className="mb-5 grid grid-cols-4 gap-1.5 rounded-xl border border-dashed border-[rgba(20,18,16,0.18)] bg-[#F6F2EA] px-3 py-3"
          >
            {(
              [
                [cd.d, "дн"],
                [cd.h, "ч"],
                [cd.m, "мин"],
                [cd.s, "сек"],
              ] as [number, string][]
            ).map(([v, label]) => (
              <div key={label} className="text-center">
                <div className="font-mono text-[20px] font-medium leading-none tabular-nums text-[#141210]">
                  {String(v).padStart(2, "0")}
                </div>
                <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onBuy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#E86A3A] text-[16px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
        >
          {data.cta.buyLabel} <span aria-hidden>→</span>
        </button>

        {/* Secondary CTA */}
        <button
          type="button"
          onClick={onPlan}
          className={cn(
            "mt-2.5 flex h-12 w-full items-center justify-center gap-2.5 rounded-full border text-[14px] font-semibold transition-colors",
            isPlanned
              ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
              : "border-[rgba(20,18,16,0.18)] bg-transparent text-[#141210] hover:border-[#141210]",
          )}
        >
          <span
            className={cn(
              "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[11px]",
              isPlanned
                ? "border-[#C24E22] bg-[#C24E22] text-white"
                : "border-[#3A332B] bg-transparent",
            )}
          >
            {isPlanned ? "✓" : ""}
          </span>
          {planLabel}
        </button>

        {/* Owner edit */}
        {data.ownerEditHref && (
          <div className="mt-2.5">
            <OwnerEditDropdown
              eventId={data.id}
              className="h-10 w-full rounded-full border border-[rgba(20,18,16,0.18)] text-[13px] font-semibold text-[rgba(20,18,16,0.55)]"
            />
          </div>
        )}

        {/* Save / Share */}
        <div className="mt-5 flex items-center justify-between border-t border-[rgba(20,18,16,0.10)] pt-4 text-[13px] text-[rgba(20,18,16,0.55)]">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[#141210]"
          >
            <span>♥</span> Сохранить
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title: data.title, url: window.location.href });
              }
            }}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[#141210]"
          >
            <span>↗</span> Поделиться
          </button>
        </div>
      </div>

      {/* Trust badge */}
      <div className="flex items-center gap-3 px-1 text-[12px] text-[rgba(20,18,16,0.55)]">
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1F8A5B] shadow-[0_0_0_4px_rgba(31,138,91,0.18)]" />
        Подтверждённый партнёр
      </div>
    </div>
  );
}
