"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { EventBreadcrumbs } from "./EventBreadcrumbs";
import { OwnerEditDropdown } from "./OwnerEditDropdown";

/**
 * Переформатирует адрес из Google-формата «Улица Дом, Город, Область»
 * в читаемый: «г. Город, Улица, Дом»
 */
function formatAddress(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return raw;

  // Отбрасываем «Область» / «район» / «Беларусь» и т.п. (последние части)
  const filtered = parts.filter(
    (p) => !/область|район|беларусь|belarus/i.test(p),
  );

  // Первая часть — «Улица Дом», остальные — город и т.д.
  const [streetHouse, ...rest] = filtered;
  const city = rest[0];

  if (!city) return raw;

  // Пробуем отделить номер дома от названия улицы (последний «токен» с цифрой)
  const houseMatch = streetHouse.match(/^(.+?)\s+(\d+\S*)$/);
  if (houseMatch) {
    const street = houseMatch[1].trim();
    const house = houseMatch[2].trim();
    return `г. ${city}, ${street}, ${house}`;
  }

  return `г. ${city}, ${streetHouse}`;
}

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
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetIso || now === null) return null;
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
          <span className="text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
            {data.ageFromBadge}
          </span>
        )}
        {/* Show first factChip as format */}
        {data.factChips[0] && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
            {data.factChips[0].label}
          </span>
        )}
      </div>

      {/* Editorial display title */}
      <h1
        style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.025em", color: "#141210" }}
      >
        {data.title}
      </h1>

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
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
              Ближайший сеанс
            </div>
            {sessionLine ? (() => {
              const parts = sessionLine.split(" · ");
              const datePart = parts[0] ?? sessionLine;
              const timePart = parts.slice(1).join(" · ");
              return (
                <div>
                  <div className="font-sans text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#141210]">
                    {datePart}
                  </div>
                  {timePart && (
                    <div className="mt-1.5 text-[13px] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                      {timePart}
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="text-[15px] text-[rgba(20,18,16,0.55)]">Расписание уточняется</div>
            )}
          </div>

          {/* Price */}
          <div className={cn("text-right", pr?.pricing)}>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
              Стоимость
            </div>
            {(() => {
              const priceStr = data.priceLabel ?? "";
              const spaceIdx = priceStr.lastIndexOf(" ");
              const numPart = spaceIdx !== -1 ? priceStr.slice(0, spaceIdx) : priceStr;
              const currencyPart = spaceIdx !== -1 ? priceStr.slice(spaceIdx + 1) : "";
              return (
                <div className="flex items-baseline justify-end gap-1">
                  <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 52, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em", color: "#141210" }}>
                    {numPart}
                  </span>
                  {currencyPart && (
                    <span className="text-[13px] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                      {currencyPart}
                    </span>
                  )}
                </div>
              );
            })()}
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
                  {formatAddress(venueAddress)}
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

        {/* Countdown — renders only after client mount to avoid hydration mismatch */}
        {cd && !cd.done && (
          <div
            suppressHydrationWarning
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
              <div key={label} className="text-center" suppressHydrationWarning>
                <div suppressHydrationWarning className="font-mono text-[20px] font-medium leading-none tabular-nums text-[#141210]">
                  {String(v).padStart(2, "0")}
                </div>
                <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA row: primary button + heart */}
        <div className="flex items-center gap-3">
          {data.cta.purchaseUrl && (
            <button
              type="button"
              onClick={onBuy}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#E86A3A] text-[16px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
            >
              {data.cta.buyLabel} <span aria-hidden>→</span>
            </button>
          )}

          <button
            type="button"
            onClick={onPlan}
            aria-label={isPlanned ? planLabel : "Добавить в план"}
            className={cn(
              "flex h-14 shrink-0 items-center justify-center rounded-full border transition-colors",
              data.cta.purchaseUrl ? "w-14" : "flex-1 gap-2 px-4 text-[16px] font-semibold",
              isPlanned
                ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.45)] hover:border-[#141210] hover:text-[#141210]",
            )}
          >
            <Heart
              size={20}
              strokeWidth={1.75}
              className={isPlanned ? "fill-[#C24E22]" : ""}
            />
            {!data.cta.purchaseUrl && (
              <span>{isPlanned ? planLabel : "Сохранить"}</span>
            )}
          </button>
        </div>

        {/* Owner edit */}
        {data.ownerEditHref && (
          <div className="mt-5 border-t border-[rgba(20,18,16,0.10)] pt-5">
            <OwnerEditDropdown
              eventId={data.id}
              className="h-14 w-full rounded-full border border-[rgba(20,18,16,0.18)] text-[16px] font-semibold text-[rgba(20,18,16,0.55)]"
            />
          </div>
        )}

        {/* Share */}
        <div className="mt-5 flex items-center justify-end border-t border-[rgba(20,18,16,0.10)] pt-5 text-[13px] text-[rgba(20,18,16,0.55)]">
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title: data.title, url: window.location.href });
              }
            }}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[#141210]"
          >
            <Share2 size={14} strokeWidth={1.75} /> Поделиться
          </button>
        </div>
      </div>


    </div>
  );
}
