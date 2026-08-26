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
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

export const BUSINESS_PUBLICATION_ACTION_NEUTRAL =
  "border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950";

export const BUSINESS_PUBLICATION_ACTION_PROMOTE =
  "bg-[#3D7A3D] text-white shadow-[0_4px_14px_rgba(61,122,61,0.28)] hover:bg-[#2f6b2f] px-4 font-semibold";

export const BUSINESS_PUBLICATION_ACTION_ICON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0 text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-50";

export const BUSINESS_PUBLICATION_ACTION_DANGER_ICON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50";

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
  updatedLine?: string | null;
  createdLine?: string | null;
  footnote?: ReactNode;
  /** Метрики для правого блока */
  metrics?: BusinessPublicationMetrics | null;
  /** Совет / подсказка внизу карточки */
  tip?: { text: string; ctaLabel?: string; ctaHref?: string } | null;
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
    <div className="flex min-w-[90px] flex-col gap-1 rounded-2xl bg-stone-50 px-4 py-3">
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
  updatedLine,
  createdLine,
  footnote,
  metrics,
  tip,
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
        "group rounded-[20px] border border-stone-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        "transition-shadow hover:shadow-[0_6px_24px_rgba(15,23,42,0.07)]",
        className,
      )}
      data-publication-type={type}
    >
      {/* ── Top section ── */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        {/* Left: avatar + info */}
        <div className="flex min-w-0 flex-1 gap-4">
          {avatarSlot}

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Type chip */}
            {typeChip ? (
              <div className="flex items-center">{typeChip}</div>
            ) : null}

            {/* Title */}
            {titleHref ? (
              <Link href={titleHref} className="block min-w-0">
                <h3 className="truncate text-xl font-bold text-stone-950 transition-colors hover:text-stone-700">
                  {title}
                </h3>
              </Link>
            ) : (
              <h3 className="min-w-0 truncate text-xl font-bold text-stone-950">
                {title}
              </h3>
            )}

            {/* Subtitle */}
            {subtitle ? (
              <p className="truncate text-sm text-stone-500">
                {typeof subtitle === "string"
                  ? renderCurrencyText(normalizeUiCurrencyText(subtitle), { iconSize: "sm" })
                  : subtitle}
              </p>
            ) : null}

            {/* Status row */}
            {statusRow ? (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {statusRow}
              </div>
            ) : null}

            {/* Footnote */}
            {footnote ? <div className="pt-0.5">{footnote}</div> : null}
          </div>
        </div>

        {/* Right: metrics */}
        {hasMetrics ? (
          <div className="flex shrink-0 gap-3 sm:self-center">
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
        ) : null}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-3">
        {/* Updated / created timestamps */}
        {hasHydrated && (updatedLine || createdLine) ? (
          <div className="mr-auto min-w-0 text-xs text-stone-400">
            {updatedLine ? <p>{updatedLine}</p> : null}
            {createdLine ? <p>{createdLine}</p> : null}
          </div>
        ) : (
          <div className="mr-auto" />
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
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
