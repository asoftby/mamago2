"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SaveFlowContainerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  /** Фиксирует высоту Dialog чтобы не прыгала при смене фаз */
  fixedHeight?: boolean;
};

/**
 * Адаптивный контейнер для save flow.
 * 
 * Desktop: Dialog (modal)
 * Mobile: Sheet (full-screen bottom sheet)
 * 
 * ВАЖНО: Контейнер определяется один раз при монтировании и не переключается.
 * Это предотвращает двойное открытие при hydration.
 */
export function SaveFlowContainer({
  open,
  onOpenChange,
  children,
  title = "Сохранить активность",
  fixedHeight = false,
}: SaveFlowContainerProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Don't render anything until after hydration — prevents Sheet + Dialog
  // mounting simultaneously when isDesktop flips from false → true.
  if (!mounted) return null;

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl border-neutral-200" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className={cn("overflow-y-auto", fixedHeight ? "h-[520px]" : "")}>{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-neutral-100 bg-white p-0 shadow-2xl",
        )}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </SheetContent>
    </Sheet>
  );
}
