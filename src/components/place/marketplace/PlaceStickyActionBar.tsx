"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceSaveHeart } from "@/features/save/PlaceSaveHeart";

export interface PlaceStickyActionBarProps {
  ctaRef?: React.RefObject<HTMLElement | null>;
  statusLabel?: string;
  addressLine?: string;
  detailLine?: string;
  phone?: string;
  placeId: string;
  placeSlug: string;
  placeTitle: string;
  coverImageUrl?: string | null;
  className?: string;
}

export function PlaceStickyActionBar({
  ctaRef,
  statusLabel,
  addressLine,
  detailLine,
  phone,
  placeId,
  placeSlug,
  placeTitle,
  coverImageUrl,
  className,
}: PlaceStickyActionBarProps) {
  const [ctaPassed, setCtaPassed] = useState(false);
  const telHref = phone ? `tel:${phone.replace(/\s/g, "")}` : undefined;

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

  if (!telHref && !placeId) return null;

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
      <div className="min-w-0 flex-1">
        {(statusLabel || addressLine) && (
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.1em]">
            {statusLabel && <span className="text-[#E86A3A]">{statusLabel}</span>}
            {statusLabel && addressLine && (
              <span className="text-[rgba(20,18,16,0.55)]"> · {addressLine}</span>
            )}
            {!statusLabel && addressLine && (
              <span className="text-[rgba(20,18,16,0.55)]">{addressLine}</span>
            )}
          </div>
        )}
        {detailLine && (
          <div className="mt-0.5 truncate font-sans text-[18px] font-normal leading-tight tracking-[-0.03em] text-[#141210]">
            {detailLine}
          </div>
        )}
      </div>

      {telHref && (
        <a
          href={telHref}
          className="inline-flex h-[46px] shrink-0 items-center gap-2 rounded-full bg-[#E86A3A] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover active:translate-y-px"
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          Позвонить
        </a>
      )}

      <PlaceSaveHeart
        placeId={placeId}
        placeSlug={placeSlug}
        placeTitle={placeTitle}
        coverImageUrl={coverImageUrl}
        source="place-detail-sticky"
        className="h-[46px] w-[46px]"
        iconClassName="h-4 w-4"
      />
    </div>
  );
}
