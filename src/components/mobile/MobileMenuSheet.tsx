"use client";

import type { ReactNode } from "react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { mobileSheetShellBase } from "@/components/ui/overlay-layout";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type MobileMenuSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** false — без строки «title + закрыть» (контент рисует свою шапку, напр. уведомления). */
  showTitleBar?: boolean;
};

export function MobileMenuSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  bodyClassName,
  showTitleBar = true,
}: MobileMenuSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          mobileSheetShellBase,
          "z-[70] max-h-[80vh] rounded-t-[24px] gap-0 p-0",
          className,
        )}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex shrink-0 justify-center pt-3">
          <span
            className="h-1.5 w-12 rounded-full bg-neutral-300"
            aria-hidden
          />
        </div>
        {showTitleBar ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 px-5 pb-3 pt-2">
            <h2 className="truncate text-lg font-semibold text-neutral-900">
              {title}
            </h2>
            <ModalCloseButton
              type="button"
              className="h-9 w-9 bg-neutral-100 text-neutral-600 shadow-none hover:bg-neutral-200"
              onClick={() => onOpenChange(false)}
            />
          </div>
        ) : null}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto bg-white pb-[max(1rem,env(safe-area-inset-bottom))]",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
