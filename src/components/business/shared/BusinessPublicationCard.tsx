"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { CalendarPlus, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

// ─── Action button style tokens ───────────────────────────────────────────────

export const BUSINESS_PUBLICATION_ACTION_BUTTON =
  "inline-flex min-h-12 h-auto min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:min-h-10 sm:w-auto sm:flex-none sm:shrink-0";

export const BUSINESS_PUBLICATION_ACTION_NEUTRAL =
  "border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950";

export const BUSINESS_PUBLICATION_ACTION_PROMOTE =
  "bg-[#3D7A3D] text-white shadow-[0_4px_14px_rgba(61,122,61,0.28)] hover:bg-[#2f6b2f] px-4 font-semibold";

/** Active Boost: muted stone slot + outer amber glow (see animate-mg-boost-amber-glow). No grey stroke. */
export const BUSINESS_PUBLICATION_ACTION_PROMOTE_ACTIVE =
  "cursor-not-allowed border border-transparent bg-stone-50 px-4 font-semibold text-stone-500 disabled:opacity-100 animate-mg-boost-amber-glow";

/** Icon-only actions: ≥44px tap target on mobile; compact on desktop. */
export const BUSINESS_PUBLICATION_ACTION_ICON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0 text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:w-9";

export const BUSINESS_PUBLICATION_ACTION_DANGER_ICON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:w-9";

/** Primary labeled actions (Статистика / Продвинуть): full-width pair on mobile.
 *  items-stretch equalizes height when the active Boost button is two-line. */
export const BUSINESS_PUBLICATION_ACTIONS_PRIMARY_ROW =
  "flex w-full items-stretch gap-3 sm:w-auto sm:shrink-0";

/** Lightning badge fill — pale cream/amber behind Zap. */
export const BUSINESS_PUBLICATION_BOOST_LIGHTNING_BG = "bg-amber-50";

/** Zap icon color on the lightning badge (also «Сейчас продвигается» label). */
export const BUSINESS_PUBLICATION_BOOST_LIGHTNING_ICON = "text-amber-500";

/** Card outer border while Boost is active — same amber family as lightning bg. */
export const BUSINESS_PUBLICATION_BOOST_BORDER = "border-amber-200";

/** Caption inside the active Boost timer button — lowercase, lightning accent. */
export const BUSINESS_PUBLICATION_PROMOTE_ACTIVE_LABEL =
  "text-[10px] font-medium leading-tight text-amber-500";

/** Icon actions: second row on mobile; inline after buttons on sm+. */
export const BUSINESS_PUBLICATION_ACTIONS_ICON_ROW =
  "flex w-full items-center justify-evenly gap-4 sm:w-auto sm:justify-start sm:gap-2";

/** Footer actions stack: column on mobile, one horizontal row on sm+. */
export const BUSINESS_PUBLICATION_ACTIONS_STACK =
  "flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BusinessPublicationType = "place" | "event" | "offer";

export interface BusinessPublicationMetrics {
  views: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  /** e.g. "+15%" — если есть, показываем под числом */
  viewsDelta?: string | null;
  planAddsDelta?: string | null;
  ctaClicksDelta?: string | null;
}

type BusinessPublicationCardProps = {
  type: BusinessPublicationType;
  imageUrl: string | null;
  imageAlt: string;
  imageHref?: string;
  placeholderIcon: LucideIcon;
  title: string;
  titleHref?: string;
  typeChip?: ReactNode;
  subtitle: ReactNode;
  statusRow?: ReactNode;
  /** Right edge of the type/status badges row (e.g. Boost lightning). */
  statusTrailing?: ReactNode;
  updatedLine?: string | null;
  createdLine?: string | null;
  footnote?: ReactNode;
  /** Метрики для правого блока */
  metrics?: BusinessPublicationMetrics | null;
  /** What window these counters represent; never label lifetime totals as today. */
  metricsPeriodLabel?: string;
  /** Совет / подсказка внизу карточки */
  tip?: { text: string; ctaLabel?: string; ctaHref?: string } | null;
  /** Active Boost: amber outer border matching lightning badge bg family. */
  isPromoted?: boolean;
  actions: ReactNode;
  className?: string;
};

// ─── Hydration helpers ────────────────────────────────────────────────────────

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// ─── Metric cell ──────────────────────────────────────────────────────────────

function MetricCell({
  icon,
  label,
  value,
  delta,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta?: string | null;
}) {
  const isPositive = delta?.startsWith("+");
  const isNegative = delta?.startsWith("-");
  const trendIcon = isPositive ? "↑" : isNegative ? "↓" : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl bg-stone-50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-stone-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-[22px] font-bold leading-none tracking-tight text-stone-900">
        {value}
      </p>
      {delta ? (
        <p
          className={cn(
            "text-xs font-semibold",
            isPositive
              ? "text-emerald-600"
              : isNegative
                ? "text-red-500"
                : "text-stone-500",
          )}
        >
          {trendIcon ? `${trendIcon} ` : ""}{delta}
        </p>
      ) : null}
    </div>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)} тыс.`;
  return n.toLocaleString("ru-RU");
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BusinessPublicationCard({
  type,
  imageUrl,
  imageAlt,
  imageHref,
  placeholderIcon: PlaceholderIcon,
  title,
  titleHref,
  typeChip,
  subtitle,
  statusRow,
  statusTrailing,
  updatedLine,
  createdLine,
  footnote,
  metrics,
  metricsPeriodLabel,
  tip,
  isPromoted = false,
  actions,
  className,
}: BusinessPublicationCardProps) {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

  const hasMetrics =
    metrics != null &&
    (type === "event" || metrics.views > 0 || metrics.ctaClicks > 0);

  // ── Avatar ──
  const avatar = (
    <div className="relative shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/70 size-[72px]">
      {imageUrl ? (
        isAppMediaUrl(imageUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes="72px"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-stone-400">
          <PlaceholderIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );

  const avatarSlot = imageHref ? (
    <Link href={imageHref} className="shrink-0 self-start" aria-label={imageAlt}>
      {avatar}
    </Link>
  ) : (
    <div className="shrink-0 self-start">{avatar}</div>
  );

  return (
    <div
      className={cn(
        "group rounded-[20px] border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        "transition-shadow hover:shadow-[0_6px_24px_rgba(15,23,42,0.07)]",
        isPromoted
          ? BUSINESS_PUBLICATION_BOOST_BORDER
          : "border-stone-200/90",
        className,
      )}
      data-publication-type={type}
      data-promoted={isPromoted ? "true" : undefined}
    >
      {/* ── Top section ── */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        {/* Left: avatar + info */}
        <div className="flex min-w-0 flex-1 gap-4">
          {avatarSlot}

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Type and status are peer pills above the publication name. */}
            {(typeChip || statusRow || statusTrailing) ? (
              <div className="flex w-full items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {typeChip}
                  {statusRow}
                </div>
                {statusTrailing}
              </div>
            ) : null}

            {/* Title */}
            {titleHref ? (
              <Link href={titleHref} className="block min-w-0">
                <h3 className="truncate text-base font-bold text-stone-950 transition-colors hover:text-stone-700 sm:text-xl">
                  {title}
                </h3>
              </Link>
            ) : (
              <h3 className="min-w-0 truncate text-base font-bold text-stone-950 sm:text-xl">
                {title}
              </h3>
            )}

            {/* Subtitle: string stays one truncated line; ReactNode can be multi-line */}
            {subtitle ? (
              typeof subtitle === "string" ? (
                <p className="truncate text-sm text-stone-500">
                  {renderCurrencyText(normalizeUiCurrencyText(subtitle), { iconSize: "sm" })}
                </p>
              ) : (
                <div className="min-w-0 w-full space-y-0.5 text-sm text-stone-500">{subtitle}</div>
              )
            ) : null}

            {/* Footnote */}
            {footnote ? <div className="pt-0.5">{footnote}</div> : null}
          </div>
        </div>

        {/* Right: metrics */}
        {hasMetrics ? (
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:shrink-0 sm:self-center">
            {metricsPeriodLabel ? (
              <p
                className="text-xs font-medium text-stone-500"
                aria-label={`Период статистики: ${metricsPeriodLabel}`}
              >
                {metricsPeriodLabel === "сегодня"
                  ? "Статистика за сегодня:"
                  : `Статистика за ${metricsPeriodLabel}:`}
              </p>
            ) : null}
            <div className="flex w-full gap-3">
              <MetricCell
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Просмотры"
                value={fmtNum(metrics!.views)}
                delta={metrics!.viewsDelta}
              />
              <MetricCell
                icon={
                  type === "event" ? (
                    <CalendarPlus className="h-3.5 w-3.5" />
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )
                }
                label={type === "event" ? "В план" : "Заявки"}
                value={fmtNum(
                  type === "event" ? metrics!.planAdds : metrics!.ctaClicks,
                )}
                delta={
                  type === "event" ? metrics!.planAddsDelta : metrics!.ctaClicksDelta
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="space-y-3 border-t border-stone-100 px-5 py-3">
        {hasHydrated && (updatedLine || createdLine) ? (
          <div className="min-w-0 text-xs text-stone-400">
            {updatedLine ? <p>{updatedLine}</p> : null}
            {createdLine ? <p>{createdLine}</p> : null}
          </div>
        ) : null}

        {/* Callers supply primary + icon rows; stack collapses to one row on sm+. */}
        <div className={BUSINESS_PUBLICATION_ACTIONS_STACK}>{actions}</div>
      </div>

      {/* ── Tip row ── */}
      {tip ? (
        <div className="flex items-start justify-between gap-4 border-t border-stone-100 px-5 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-700">Совет</p>
              <p className="text-xs text-stone-500">{tip.text}</p>
            </div>
          </div>
          {tip.ctaLabel && tip.ctaHref ? (
            <Link
              href={tip.ctaHref}
              className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline"
            >
              {tip.ctaLabel} →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
