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
  mobileSheetHeightFull,
  mobileSheetHeightTall,
  mobileSheetShellBase,
  overlaySafeFooterPadding,
} from "@/components/ui/overlay-layout";

const DESKTOP_MEDIA = "(min-width: 768px)";

export type ResponsiveOverlayHeightMode = "tall" | "full";

export type ResponsiveOverlayVariant = "chromeless" | "framed";

export type ResponsiveOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Заголовок для скринридеров; при visibleTitle=false остаётся sr-only */
  a11yTitle: string;
  variant?: ResponsiveOverlayVariant;
  /** Показать визуальный заголовок (framed) */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  showCloseButton?: boolean;
  /** Полоска над контентом на mobile (см. MyPlanOverlay — свой handle) */
  mobileTopSlot?: React.ReactNode;
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
  title,
  subtitle,
  children,
  footer,
  dismissible = true,
  showCloseButton = true,
  mobileTopSlot,
  heightMode = "tall",
  dialogContentClassName,
  sheetContentClassName,
  bodyClassName,
  className,
}: ResponsiveOverlayProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA);

  const heightClass =
    heightMode === "full" ? mobileSheetHeightFull : mobileSheetHeightTall;

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

  const body = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        variant === "chromeless" && "min-h-0",
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
          overlaySafeFooterPadding,
        )}
      >
        {footer}
      </div>
    ) : null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          dismissible={dismissible}
          showCloseButton={false}
          className={cn(
            desktopDialogShellLarge,
            variant === "framed" && "!max-h-[90vh]",
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
        showCloseButton={false}
        className={cn(
          mobileSheetShellBase,
          heightClass,
          sheetContentClassName,
          className,
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{a11yTitle}</SheetTitle>
        </SheetHeader>
        {mobileTopSlot}
        {variant === "framed" ? framedHeader : null}
        {body}
        {footerEl}
      </SheetContent>
    </Sheet>
  );
}
