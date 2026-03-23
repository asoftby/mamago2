"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import { SecondaryFiltersForm } from "@/components/discovery/SecondaryFiltersForm";
import type { Intent } from "@/lib/intent";
import type { SecondaryValues } from "@/lib/discovery/secondaryFiltersUrl";

/** @deprecated Используйте SecondaryValues из secondaryFiltersUrl */
export type FilterState = SecondaryValues;

/**
 * Mobile-only: bottom sheet с secondary-фильтрами.
 * Desktop: модальное окно (Dialog) в RefinementFiltersButtonCompact.
 */
export function RefinementFiltersModal() {
  const { isOpen, setIsOpen, currentIntent } = useRefinementFilters();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isVisible || !currentIntent) return null;

  const intent = currentIntent as Intent;

  const stickyHeader = (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 pb-4">
      <h2 className="text-lg font-semibold text-gray-900">Фильтры</h2>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
      >
        <X className="h-5 w-5 text-gray-500" />
      </button>
    </div>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] md:hidden">
        <div
          className={cn(
            "fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out",
            isOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsOpen(false)}
          aria-hidden
        />

        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden transition-transform duration-300 ease-out flex flex-col",
            isOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex-shrink-0 p-6 pb-0">{stickyHeader}</div>

          <div className="flex-1 overflow-y-auto px-6 pt-4">
            <SecondaryFiltersForm
              intent={intent}
              compact
              onApply={() => setIsOpen(false)}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
