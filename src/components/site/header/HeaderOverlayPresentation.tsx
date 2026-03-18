"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { DesktopSearchControl } from "./DesktopSearchControl";
import type { HeaderMode, HeaderPanel } from "@/hooks/useHeaderBehavior";

interface HeaderOverlayPresentationProps {
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

export function HeaderOverlayPresentation({
  citySlug,
  currentIntent,
  shouldShowIntentTabs,
  shouldShowFilters,
  headerBehavior
}: HeaderOverlayPresentationProps) {
  
  return (
    <div className="relative">
      
      {/* CLOSE BUTTON */}
      <button
        onClick={headerBehavior.actions.collapseOverlay}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors shadow-sm"
        aria-label="Закрыть"
      >
        <X className="h-4 w-4 text-gray-600" />
      </button>
      
      <div className="flex flex-col py-6">
        
        {/* INTENT TABS AREA */}
        <div className="flex items-center justify-center h-[48px] relative overflow-hidden mb-4">
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
        <div className="flex items-center justify-center">
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
    </div>
  );
}