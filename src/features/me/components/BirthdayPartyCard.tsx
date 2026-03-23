"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { UserBirthdayParty } from "@/features/me/types/userBirthdayParty";
import {
  formatPartyDateTimeCompact,
  getConfirmationProgressUi,
  getPartyCtaLabel,
  getPartyNameLine,
  getPartyShortSummary,
} from "@/features/me/lib/userBirthdayPartyUi";
import { getPartyScenarioFlowUi } from "@/features/me/lib/partyScenarioFlow";
import { BirthdayPartyScenarioFlow } from "@/features/me/components/BirthdayPartyScenarioFlow";
import { cn } from "@/lib/utils";

type BirthdayPartyCardProps = {
  party: UserBirthdayParty;
  /** чуть плотнее отступы в превью-блоке профиля */
  compact?: boolean;
};

/**
 * Карточка: дата/время → имя → прогресс → сценарный flow → опц. summary → CTA
 */
export function BirthdayPartyCard({ party, compact }: BirthdayPartyCardProps) {
  const when = formatPartyDateTimeCompact(party);
  const name = getPartyNameLine(party);
  const progress = getConfirmationProgressUi(party);
  const scenarioFlow = getPartyScenarioFlowUi(party);
  const summary = scenarioFlow ? null : getPartyShortSummary(party);
  const cta = getPartyCtaLabel(party.status);

  return (
    <Link
      href={`/me/birthdays/${party.id}`}
      className={cn(
        "group flex items-center gap-3 sm:gap-4 rounded-2xl border border-neutral-100/90 bg-white",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200",
        "hover:border-primary/20 hover:bg-orange-50/25 hover:shadow-[0_4px_20px_rgba(239,135,89,0.08)]",
        "active:scale-[0.99] active:bg-orange-50/35",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2",
        compact ? "px-3.5 py-3.5 sm:px-4 sm:py-4" : "px-4 py-4 sm:px-5 sm:py-4",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        {when ? (
          <p className="text-[15px] sm:text-base font-semibold text-foreground tabular-nums leading-tight tracking-tight">
            {when}
          </p>
        ) : null}
        <p className="text-sm font-medium text-foreground leading-snug truncate">
          {name}
        </p>
        {progress.showBar ? (
          <div className="space-y-0.5 pt-0.5">
            <div
              className={cn(
                "h-1 w-full rounded-full overflow-hidden",
                progress.trackClass,
              )}
              role="progressbar"
              aria-valuenow={progress.fillPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full min-w-0 transition-[width] duration-300",
                  progress.fillClass,
                )}
                style={{ width: `${progress.fillPct}%` }}
              />
            </div>
            <p
              className={cn(
                "text-[11px] leading-tight tabular-nums",
                progress.labelClass,
              )}
            >
              {progress.label}
            </p>
          </div>
        ) : (
          <p className={cn("text-xs leading-snug", progress.labelClass)}>
            {progress.label}
          </p>
        )}
        {scenarioFlow ? (
          <div className="pt-1 min-w-0">
            <BirthdayPartyScenarioFlow flow={scenarioFlow} />
          </div>
        ) : null}
        {summary ? (
          <p className="text-[11px] sm:text-xs text-muted-foreground/85 truncate">
            {summary}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 shrink-0 text-sm font-semibold text-primary",
          "group-hover:text-primary/90",
        )}
      >
        {cta}
        <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
      </span>
    </Link>
  );
}
