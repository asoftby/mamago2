"use client";

import { cn } from "@/lib/utils";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { DesktopSearchControl } from "./DesktopSearchControl";
import type { HeaderMode, HeaderPanel } from "@/hooks/useHeaderBehavior";

interface HeaderExpandedPresentationProps {
  citySlug: string;
  currentIntent?: string | null;
  shouldShowIntentTabs: boolean;
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

export function HeaderExpandedPresentation({
  citySlug,
  currentIntent,
  shouldShowIntentTabs,
  shouldShowFilters,
  headerBehavior
}: HeaderExpandedPresentationProps) {
  
  return (
    <div className="flex flex-col h-full">
      
      {/* INTENT TABS AREA */}
      <div className="flex items-center justify-center h-[48px] relative overflow-hidden">
        {shouldShowIntentTabs && (
          <div className="flex items-center justify-center whitespace-nowrap">
            <DiscoveryIntentTabs
              city={citySlug}
              currentIntent={(currentIntent || "kuda") as any}
            />
          </div>
        )}
      </div>
      
      {/* SEARCH AREA */}
      <div className="flex items-center justify-center flex-1 pt-4 pb-6">
        <div className="w-full max-w-[850px]">
          <DesktopSearchControl
            citySlug={citySlug}
            currentIntent={currentIntent}
            mode="expanded"
            activePanel={headerBehavior.activePanel}
            onPanelChange={headerBehavior.actions.openPanel}
            onPanelClose={headerBehavior.actions.closePanel}
          />
        </div>
      </div>
      
    </div>
  );
}