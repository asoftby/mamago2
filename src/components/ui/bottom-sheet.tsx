"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Скрыть заголовок визуально (но оставить для screen readers) */
  hideTitle?: boolean;
  /** Показать кнопку закрытия в хедере */
  showCloseButton?: boolean;
  /** Высота sheet (по умолчанию 85vh) */
  height?: string;
  /** Дополнительные классы для контента */
  className?: string;
  /** Дополнительные классы для хедера */
  headerClassName?: string;
  /** Контент хедера (если нужен кастомный) */
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  /** Dismissible (можно ли закрыть свайпом/кликом вне) */
  dismissible?: boolean;
}

export function BottomSheet({
  open,
  onOpenChange,
  title = "Заголовок",
  hideTitle = false,
  showCloseButton = true,
  height = "85vh",
  className,
  headerClassName,
  headerContent,
  children,
  dismissible = true,
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("p-0 rounded-t-2xl flex flex-col gap-0 bg-white", className)}
        style={{ height }}
        showCloseButton={false}
        dismissible={dismissible}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        
        {/* Unified Header */}
        <div
          className={cn(
            "relative flex items-center flex-shrink-0 border-b border-gray-200 px-4 py-5 bg-gray-50 rounded-t-2xl",
            headerClassName
          )}
        >
          {headerContent ? (
            headerContent
          ) : (
            <>
              {!hideTitle && (
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
