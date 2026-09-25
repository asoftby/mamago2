"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import { SecondaryFiltersForm } from "@/components/discovery/SecondaryFiltersForm";
import type { Intent } from "@/lib/intent";
import type { SecondaryValues } from "@/lib/discovery/secondaryFiltersUrl";
import { EventAdvancedFilters } from "@/components/discovery/EventAdvancedFilters";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";

/** @deprecated Используйте SecondaryValues из secondaryFiltersUrl */
export type FilterState = SecondaryValues;

/**
 * Mobile-only: bottom sheet с secondary-фильтрами.
 * Desktop: модальное окно (Dialog) в RefinementFiltersButtonCompact.
 */
export function RefinementFiltersModal() {
  const { isOpen, setIsOpen, currentIntent } = useRefinementFilters();
  const [isVisible, setIsVisible] = useState(() => isOpen);
  const citySlug = useOptionalCity()?.citySlug ?? DEFAULT_CITY_SLUG;
  const prevIsOpenRef = useRef(isOpen);

  // Sync visibility with animation delay
  useEffect(() => {
    if (prevIsOpenRef.current === isOpen) return;
    prevIsOpenRef.current = isOpen;
    
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
      setIsVisible(false);
    };
    closeForDesktop();
    mq.addEventListener("change", closeForDesktop);
    return () => mq.removeEventListener("change", closeForDesktop);
  }, [isOpen, setIsOpen]);

  if (!isVisible || !currentIntent) return null;

  const intent = currentIntent as Intent;

  const stickyHeader = (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white pb-3">
      <h2 className="text-lg font-semibold text-gray-900">Фильтры</h2>
      <ModalCloseButton
        type="button"
        onClick={() => setIsOpen(false)}
        className="h-11 w-11 bg-gray-50 text-gray-600 shadow-none hover:bg-gray-100"
      />
    </div>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] lg:hidden">
        <div
          className={cn(
            "fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out",
            isOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
          // pointer-events-none когда закрыт — не перехватывает клики
          style={!isOpen ? { pointerEvents: "none" } : undefined}
        />

        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 flex h-[88dvh] max-h-[calc(100dvh-0.75rem)] flex-col overflow-hidden rounded-t-3xl bg-white transition-transform duration-300 ease-out",
            isOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex-shrink-0 px-4 pb-0 pt-3 sm:px-6 sm:pt-5">
            <div className="mb-2 flex justify-center" aria-hidden>
              <span className="h-1.5 w-12 rounded-full bg-neutral-300" />
            </div>
            {stickyHeader}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6">
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
