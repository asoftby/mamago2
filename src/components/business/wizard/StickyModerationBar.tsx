"use client";

import { Button } from "@/components/ui/button";

interface StickyModerationBarProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  hasChanges: boolean;
  isVisible: boolean;
}

export function StickyModerationBar({
  onSubmit,
  isSubmitting,
  hasChanges,
  isVisible,
}: StickyModerationBarProps) {
  // Debug logging
  console.log("[StickyModerationBar] Render:", {
    isVisible,
    hasChanges,
    isSubmitting,
  });
  
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {hasChanges ? "У вас есть несохраненные изменения" : "Нет изменений для отправки"}
          </div>
          <Button
            onClick={onSubmit}
            disabled={!hasChanges || isSubmitting}
            size="lg"
            className="min-w-[200px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Отправляем...
              </>
            ) : (
              "Отправить на модерацию"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}