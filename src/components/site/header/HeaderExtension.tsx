"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { DesktopSearchControl } from "./DesktopSearchControl";
import type { HeaderPanel } from "@/hooks/useHeaderBehavior";
import type { Intent } from "@/lib/intent";

interface HeaderExtensionProps {
  citySlug: string;
  currentIntent?: Intent | null;
  shouldShowIntentTabs: boolean;
  isVisible: boolean;
  activePanel: HeaderPanel;
  onPanelChange: (panel: HeaderPanel) => void;
  onPanelClose: () => void;
  onClose?: () => void; // Добавляем callback для закрытия
}

/**
 * Header Extension - Нижний уровень
 * 
 * Расширенная форма поиска с labels и дополнительными элементами.
 * 
 * КЛЮЧЕВЫЕ ПРИНЦИПЫ:
 * - Находится под HeaderChrome
 * - Визуально выглядит частью header
 * - НО технически не участвует в document flow
 * - Реализован как floating layer (position absolute/fixed)
 * - Анимируется через opacity и transform
 * - Остается в DOM, меняет только presentation state
 */
export function HeaderExtension({
  citySlug,
  currentIntent,
  shouldShowIntentTabs,
  isVisible,
  activePanel,
  onPanelChange,
  onPanelClose,
  onClose
}: HeaderExtensionProps) {
  
  return (
    <div
      data-header-extension
      className={cn(
        "fixed left-0 right-0 z-40",
        "bg-white border-b border-gray-200 shadow-lg",
        "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "will-change-transform will-change-opacity transform-gpu",
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-4 pointer-events-none"
      )}
      style={{
        top: "95px", // Позиционируется под HeaderChrome (95px)
        backfaceVisibility: "hidden"
      }}
    >
      {/* Backdrop blur effect */}
      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative mx-auto w-full max-w-[1200px] px-4 py-6">
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors shadow-sm"
            aria-label="Закрыть поиск"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        )}
        
        <div className="flex flex-col gap-4">
          
          {/* Intent Tabs - Reuse existing component */}
          {shouldShowIntentTabs && (
            <div className="flex items-center justify-center">
              <DiscoveryIntentTabs
                city={citySlug}
                currentIntent={currentIntent ?? null}
              />
            </div>
          )}
          
          {/* Expanded Search Form - Reuse existing component */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[850px]">
              <DesktopSearchControl
                citySlug={citySlug}
                currentIntent={currentIntent}
                mode="expanded"
                activePanel={activePanel}
                onPanelChange={onPanelChange}
                onPanelClose={onPanelClose}
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}