"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoostCountdown } from "@/lib/promotion/useBoostCountdown";
import {
  formatBoostCountdownHms,
  formatBoostCountdownAria,
} from "@/lib/promotion/boostCountdown";
import {
  BUSINESS_PUBLICATION_ACTION_BUTTON,
  BUSINESS_PUBLICATION_ACTION_PROMOTE_ACTIVE,
  BUSINESS_PUBLICATION_BOOST_LIGHTNING_BG,
  BUSINESS_PUBLICATION_BOOST_LIGHTNING_ICON,
  BUSINESS_PUBLICATION_PROMOTE_ACTIVE_LABEL,
} from "@/components/business/shared/BusinessPublicationCard";

/** Grey inert «Продвинуть» slot with live countdown while Boost is active. */
export function PublicationBoostActiveButton({
  endsAt,
  className,
}: {
  endsAt?: Date | string | null;
  className?: string;
}) {
  const { remainingMs } = useBoostCountdown(endsAt ?? null);
  const router = useRouter();
  const refreshedDeadline = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt || remainingMs !== 0) return;
    const deadlineMs = new Date(endsAt).getTime();
    if (!Number.isFinite(deadlineMs) || refreshedDeadline.current === deadlineMs) return;
    refreshedDeadline.current = deadlineMs;
    // Server recomputes eligibility; never grant the next Boost from the client timer.
    router.refresh();
  }, [endsAt, remainingMs, router]);
  const label =
    remainingMs == null
      ? "Продвигается"
      : remainingMs <= 0
        ? "00:00:00"
        : formatBoostCountdownHms(remainingMs);
  const ariaLabel =
    remainingMs == null
      ? "Продвижение активно"
      : remainingMs <= 0
        ? "Продвижение завершено"
        : formatBoostCountdownAria(remainingMs);

  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        BUSINESS_PUBLICATION_ACTION_BUTTON,
        BUSINESS_PUBLICATION_ACTION_PROMOTE_ACTIVE,
        "flex-col gap-0.5 py-1.5",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Zap className="h-4 w-4 shrink-0" aria-hidden />
        <span className="tabular-nums">{label}</span>
      </span>
      <span className={BUSINESS_PUBLICATION_PROMOTE_ACTIVE_LABEL}>
        {remainingMs === 0 ? "продвижение завершено" : "сейчас продвигается"}
      </span>
    </button>
  );
}

/** Lightning on the right edge of the type/status badges row. */
export function PublicationBoostLightningBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-amber-100",
        BUSINESS_PUBLICATION_BOOST_LIGHTNING_BG,
        BUSINESS_PUBLICATION_BOOST_LIGHTNING_ICON,
        className,
      )}
      title="Продвигается"
      aria-label="Продвигается"
    >
      <Zap className="h-3.5 w-3.5 fill-current" aria-hidden />
    </span>
  );
}
