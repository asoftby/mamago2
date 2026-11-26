"use client";

import * as React from "react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  desktopDialogShellLarge,
  mobileSheetHeightContent,
  mobileSheetHeightFull,
  mobileSheetHeightTall,
  mobileSheetShellBase,
  overlaySafeFooterPadding,
} from "@/components/ui/overlay-layout";

const DESKTOP_MEDIA = "(min-width: 768px)";

export type ResponsiveOverlayHeightMode = "tall" | "full" | "content";

export type ResponsiveOverlayVariant = "chromeless" | "framed";

export type ResponsiveOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Заголовок для скринридеров; при visibleTitle=false остаётся sr-only */
  a11yTitle: string;
  variant?: ResponsiveOverlayVariant;
  /** Booking/admin work panels can opt into a right-side drawer on every viewport. */
  placement?: "responsive" | "right";
  /** Показать визуальный заголовок (framed) */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  /** Optional Radix outside-interaction guard for portalled controls (e.g. undo toast). */
  onInteractOutside?: React.ComponentProps<typeof DialogContent>["onInteractOutside"];
  showCloseButton?: boolean;
  /** Полоска над контентом на mobile (см. MyPlanOverlay — свой handle) */
  mobileTopSlot?: React.ReactNode;
  /**
   * - tall/full: fixed sheet height, body flex-grows (stats, my-plan, …)
   * - content: sheet height = header + body + footer (capped); no empty flex-1 gap
   */
  heightMode?: ResponsiveOverlayHeightMode;
  dialogContentClassName?: string;
  sheetContentClassName?: string;
  bodyClassName?: string;
  className?: string;
};

/**
 * Единый адаптивный слой: desktop → Dialog, mobile (<768px) → bottom Sheet.
 * Используйте для новых модалок; постепенно заменяйте пары Dialog+Sheet вручную.
 */
export function ResponsiveOverlay({
  open,
  onOpenChange,
  a11yTitle,
  variant = "framed",
  placement = "responsive",
  title,
  subtitle,
  children,
  footer,
  dismissible = true,
  onInteractOutside,
  showCloseButton = true,
  mobileTopSlot,
  heightMode = "tall",
  dialogContentClassName,
  sheetContentClassName,
  bodyClassName,
  className,
}: ResponsiveOverlayProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA);
  const fitContent = heightMode === "content";

  const heightClass =
    heightMode === "full"
      ? mobileSheetHeightFull
      : heightMode === "content"
        ? mobileSheetHeightContent
        : mobileSheetHeightTall;

  const framedHeader =
    variant === "framed" && (title != null || subtitle != null || showCloseButton) ? (
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200/90 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0 flex-1 space-y-0.5">
          {title != null ? (
            <h2 className="text-lg font-semibold leading-snug text-neutral-900">{title}</h2>
          ) : null}
          {subtitle != null ? (
            <p className="text-sm leading-snug text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        {showCloseButton ? (
          <ModalCloseButton
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0"
          />
        ) : null}
      </div>
    ) : null;

  // tall/full: flex-1 fills remaining sheet height (scroll belongs on children).
  // content: no flex-1 — body is only as tall as its children; scrolls if sheet hits max-h.
  const body = (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        fitContent ? "overflow-y-auto overscroll-contain" : "flex-1 overflow-hidden",
        bodyClassName,
      )}
    >
      {children}
    </div>
  );

  const footerEl =
    footer != null ? (
      <div
        className={cn(
          "shrink-0 border-t border-neutral-200/90 bg-white",
          // mt-auto only for fixed-height sheets; on content-sized it would create empty gap.
          !fitContent && "mt-auto",
          overlaySafeFooterPadding,
        )}
      >
        {footer}
      </div>
    ) : null;

  if (placement === "right") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          dismissible={dismissible}
          onInteractOutside={onInteractOutside}
          showCloseButton={false}
          className={cn(
            "h-dvh w-full !max-w-[min(100vw,680px)] gap-0 overflow-hidden border-l border-neutral-200 bg-white p-0",
            sheetContentClassName,
            className,
          )}
        >
          <SheetHeader className="sr-only"><SheetTitle>{a11yTitle}</SheetTitle></SheetHeader>
          {variant === "framed" ? framedHeader : null}
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", bodyClassName)}>
            {children}
          </div>
          {footerEl}
        </SheetContent>
      </Sheet>
    );
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          dismissible={dismissible}
          onInteractOutside={onInteractOutside}
          showCloseButton={false}
          className={cn(
            fitContent
              ? "flex max-h-[min(90vh,100dvh)] w-[min(92vw,28rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-0 shadow-2xl"
              : cn(
                  desktopDialogShellLarge,
                  variant === "framed" && "!max-h-[90vh]",
                ),
            dialogContentClassName,
            className,
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{a11yTitle}</DialogTitle>
          </DialogHeader>
          {variant === "framed" ? framedHeader : null}
          {body}
          {footerEl}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        dismissible={dismissible}
        onInteractOutside={onInteractOutside}
        showCloseButton={false}
        className={cn(
          mobileSheetShellBase,
          heightClass,
          "!gap-0",
          sheetContentClassName,
          className,
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{a11yTitle}</SheetTitle>
        </SheetHeader>
        {mobileTopSlot ? <div className="shrink-0">{mobileTopSlot}</div> : null}
        {variant === "framed" ? framedHeader : null}
        {body}
        {footerEl}
      </SheetContent>
    </Sheet>
  );
}
