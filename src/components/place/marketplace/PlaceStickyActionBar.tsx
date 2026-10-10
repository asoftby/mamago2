"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedPlacePhone } from "@/lib/place/placePhones";
import { PlacePhoneActionButton } from "@/components/place/PlacePhoneActions";

export interface PlaceStickyActionBarProps {
  ctaRef?: React.RefObject<HTMLElement | null>;
  statusLabel?: string;
  /** Цвет статуса: открыто — зелёный, закрыто — красный; без значения — акцентный оранжевый. */
  statusTone?: "open" | "closed";
  addressLine?: string;
  detailLine?: string;
  phones: NormalizedPlacePhone[];
  placeId: string;
  placeSlug: string;
  placeTitle: string;
  coverImageUrl?: string | null;
  className?: string;
  /** Optional "Заявка" CTA (Direct) — additive, mirrors the desktop PlaceHero slot so mobile isn't missing the primary request path. */
  directSlot?: React.ReactNode;
}

export function PlaceStickyActionBar({
  ctaRef,
  statusLabel,
  statusTone,
  addressLine,
  detailLine,
  phones,
  placeId,
  placeTitle,
  className,
  directSlot,
}: PlaceStickyActionBarProps) {
  const hasThreeActions = Boolean(directSlot) && phones.length > 0;
  const [ctaPassed, setCtaPassed] = useState(false);
  useEffect(() => {
    const el = ctaRef?.current;
    const syncFromScroll = () => {
      if (el) {
        setCtaPassed(el.getBoundingClientRect().bottom <= 0);
        return;
      }
      setCtaPassed(window.scrollY > 280);
    };
    syncFromScroll();
    if (!("IntersectionObserver" in window) || !el) {
      window.addEventListener("scroll", syncFromScroll, { passive: true });
      return () => window.removeEventListener("scroll", syncFromScroll);
    }
    const observer = new IntersectionObserver(
      ([entry]) => setCtaPassed(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(el);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncFromScroll);
    };
  }, [ctaRef]);

  if (phones.length === 0 && !placeId) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex lg:hidden",
        "transition-transform duration-200 ease-out",
        ctaPassed ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none",
        "items-center gap-3 px-3.5 py-2.5",
        "border-t border-[rgba(20,18,16,0.10)] bg-[rgba(250,247,241,0.95)] backdrop-blur-[14px]",
        "shadow-[0_-10px_30px_-10px_rgba(20,18,16,0.18)]",
        "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
        className,
      )}
      role="region"
      aria-label="Действия с местом"
      aria-hidden={!ctaPassed}
    >
      <div className={cn("min-w-0 flex-1", hasThreeActions && "hidden sm:block")}>
        {detailLine && (
          <div className="truncate font-sans text-[18px] font-normal leading-tight tracking-[-0.03em] text-[#141210]">
            {detailLine}
          </div>
        )}
        {(addressLine || statusLabel) && (
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] leading-tight text-[rgba(20,18,16,0.55)]">
            {addressLine && <span className="min-w-0 truncate">{addressLine}</span>}
            {statusLabel && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 font-medium",
                  statusTone === "open" && "text-[#1F8A5B]",
                  statusTone === "closed" && "text-[#E5322D]",
                )}
              >
                {statusTone && <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />}
                {statusLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {directSlot}

      {phones.length > 0 && (
        <PlacePhoneActionButton
          phones={phones}
          placeTitle={placeTitle}
          className={cn(
            "inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#E86A3A] text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover active:translate-y-px",
            hasThreeActions ? "w-[46px] px-0 sm:w-auto sm:px-5" : "px-5",
          )}
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          <span className={cn(hasThreeActions && "sr-only sm:not-sr-only")}>Позвонить</span>
        </PlacePhoneActionButton>
      )}
    </div>
  );
}
