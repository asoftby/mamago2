"use client";

import { cn } from "@/lib/utils";
import { DesktopSearchControl } from "./DesktopSearchControl";
import type { HeaderPanel } from "@/hooks/useStableHeaderBehavior";

interface SearchSurfaceProps {
  citySlug: string;
  isCityHub: boolean;
  currentIntent?: string | null;
  shouldShowIntentTabs: boolean;
  shouldShowFilters: boolean;
  isVisible: boolean;
  activePanel: HeaderPanel;
  onPanelChange: (panel: HeaderPanel) => void;
  onPanelClose: () => void;
  onClose: () => void;
  headerHeight: number;
}

/**
 * Search Surface - Floating Layer
 * 
 * Floating search surface that appears under HeaderChrome.
 * Does not participate in document flow, preventing layout shift.
 * Uses existing visual components to maintain design consistency.
 */
export function SearchSurface({
  citySlug,
  isCityHub,
  currentIntent,
  shouldShowIntentTabs,
  shouldShowFilters,
  isVisible,
  activePanel,
  onPanelChange,
  onPanelClose,
  onClose,
  headerHeight
}: SearchSurfaceProps) {
  
  return (
    <div
      data-search-surface
      className="fixed left-0 right-0 z-40 bg-white transform-gpu"
      style={{
        top: `${headerHeight}px`,
        backfaceVisibility: "hidden"
      }}
    >
      <div className="relative mx-auto w-full max-w-[1200px] px-4 py-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[760px]">
              <DesktopSearchControl
                citySlug={citySlug}
                currentIntent={currentIntent}
                mode="expanded"
                activePanel={activePanel}
                onPanelChange={onPanelChange}
                onPanelClose={onPanelClose}
                renderPanels={true}
                variant={isCityHub ? "cityHub" : "discovery"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}