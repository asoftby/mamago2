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
    <div className="flex h-full items-center justify-center">
      <div className="flex min-h-0 w-full max-w-[500px] items-stretch gap-3">
        
        {/* COMPACT SEARCH */}
        <div className="flex min-h-11 flex-1 items-stretch">
          <DesktopSearchControl
            className="h-full min-h-11"
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
          <div className="flex min-h-11 shrink-0 items-stretch">
            <RefinementFiltersButtonCompact intent={currentIntent} />
          </div>
        )}
        
      </div>
    </div>
  );
}