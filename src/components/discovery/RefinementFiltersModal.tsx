"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import { SecondaryFiltersForm } from "@/components/discovery/SecondaryFiltersForm";
import type { Intent } from "@/lib/intent";
import type { SecondaryValues } from "@/lib/discovery/secondaryFiltersUrl";
import { EventAdvancedFilters } from "@/components/discovery/EventAdvancedFilters";
import { useEventListingCitySlug } from "@/lib/city/useEventListingCitySlug";

/** @deprecated Используйте SecondaryValues из secondaryFiltersUrl */
export type FilterState = SecondaryValues;

/**
 * Mobile-only: bottom sheet с secondary-фильтрами.
 * Desktop: модальное окно (Dialog) в RefinementFiltersButtonCompact.
 */
export function RefinementFiltersModal() {
  const { isOpen, setIsOpen, currentIntent } = useRefinementFilters();
  const [isVisible, setIsVisible] = useState(() => isOpen);
  const [isEntered, setIsEntered] = useState(false);
  const citySlug = useEventListingCitySlug();

  // Keep the sheet mounted while closing, but mount it below the viewport when opening.
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      return;
    }
    setIsEntered(false);
    const timer = window.setTimeout(() => setIsVisible(false), 300);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Two paints ensure the browser sees translate-y-full before transitioning to 0.
  // Without this the sheet mounts already open and appears abruptly on mobile Safari.
  useEffect(() => {
    if (!isVisible || !isOpen) return;
    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setIsEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame != null) window.cancelAnimationFrame(secondFrame);
    };
  }, [isVisible, isOpen]);

  // Keyed on isVisible (DOM-presence window), not isOpen, so the lock stays
  // held through the 300ms close animation instead of releasing early while
  // the sheet is still on screen.
  useEffect(() => {
    if (!isVisible) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isVisible]);

  // The sheet is `lg:hidden` in CSS, so at >=1024px it's already invisible
  // while still "open" in state — without this, resizing past the desktop
  // breakpoint would leave the scroll lock above stuck forever (the effect
  // only releases it when isVisible flips to false). Close immediately
  // (skip the 300ms animation) so the lock and any stale RefinementFilters
  // context state don't survive the jump to the desktop Dialog UI.
  useEffect(() => {
    if (!isOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const closeForDesktop = () => {
      if (!mq.matches) return;
      setIsOpen(false);
      setIsEntered(false);
      setIsVisible(false);
    };
    closeForDesktop();
    mq.addEventListener("change", closeForDesktop);
    return () => mq.removeEventListener("change", closeForDesktop);
  }, [isOpen, setIsOpen]);

  if (!isVisible || !currentIntent) return null;

  const intent = currentIntent as Intent;

  const stickyHeader = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 bg-white px-4 py-3 sm:px-5">
      <h2 className="text-lg font-semibold text-neutral-900">Фильтры</h2>
      <ModalCloseButton
        type="button"
        onClick={() => setIsOpen(false)}
        size="touch"
        className="shrink-0"
      />
    </div>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] lg:hidden">
        <div
          className={cn(
            "fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none",
            isEntered ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
          // pointer-events-none когда закрыт — не перехватывает клики
          style={!isOpen ? { pointerEvents: "none" } : undefined}
        />

        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 flex h-[88dvh] max-h-[calc(100dvh-0.75rem)] flex-col overflow-hidden rounded-t-3xl bg-white transition-transform duration-300 ease-out motion-reduce:transition-none",
            isEntered ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex-shrink-0">{stickyHeader}</div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6 pb-32 lg:pb-0">
            {intent === "kuda" ? (
              <EventAdvancedFilters citySlug={citySlug} onApply={() => setIsOpen(false)} />
            ) : (
              <SecondaryFiltersForm intent={intent} compact onApply={() => setIsOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
