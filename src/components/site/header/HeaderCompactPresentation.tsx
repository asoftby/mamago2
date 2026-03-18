"use client";

import { cn } from "@/lib/utils";
import { DesktopSearchControl } from "./DesktopSearchControl";
import { RefinementFiltersButtonCompact } from "@/components/discovery/RefinementFiltersButtonCompact";
import type { HeaderMode, HeaderPanel } from "@/hooks/useHeaderBehavior";

interface HeaderCompactPresentationProps {
  citySlug: string;
  currentIntent?: string | null;
  shouldShowFilters: boolean;
  headerBehavior: {
    mode: HeaderMode;
    activePanel: HeaderPanel;
    actions: {
      openPanel: (panel: HeaderPanel) => void;
      closePanel: () => void;
      expandOverlay: () => void;
      collapseOverlay: () => void;
    };
  };
}

export function HeaderCompactPresentation({
  citySlug,
  currentIntent,
  shouldShowFilters,
  headerBehavior
}: HeaderCompactPresentationProps) {
  
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-3 w-full max-w-[500px]">
        
        {/* COMPACT SEARCH */}
        <div className="flex-1">
          <DesktopSearchControl
            citySlug={citySlug}
            currentIntent={currentIntent}
            mode="compact"
            activePanel={headerBehavior.activePanel}
            onPanelChange={headerBehavior.actions.openPanel}
            onPanelClose={headerBehavior.actions.closePanel}
            onExpand={headerBehavior.actions.expandOverlay}
          />
        </div>
        
        {/* COMPACT FILTERS BUTTON */}
        {shouldShowFilters && currentIntent && (
          <div className="flex-shrink-0">
            <RefinementFiltersButtonCompact intent={currentIntent} />
          </div>
        )}
        
      </div>
    </div>
  );
}