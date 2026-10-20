"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ModalCloseButton } from "@/components/ui/modal-close-button";

/**
 * Shared visual chrome for conventional modal flows. Based on the public
 * fullscreen Search overlay; this does not replace Dialog/Sheet primitives.
 *
 * Explicitly opt in: special-purpose overlays (SaveToPlanModal, galleries,
 * stories, My Plan panel) retain their existing presentation and behavior.
 */
type ModalHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  /** Pass DialogTitle / SheetTitle when mounted inside a Radix overlay. */
  title: React.ReactNode;
  onClose?: () => void;
  closeButtonClassName?: string;
};

export function ModalHeader({
  title,
  onClose,
  children,
  className,
  closeButtonClassName,
  ...props
}: ModalHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-white px-4 py-3",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="w-10 shrink-0" aria-hidden="true" />
        {title}
        {onClose ? (
          <ModalCloseButton
            type="button"
            onClick={onClose}
            className={cn("-mr-2 shrink-0", closeButtonClassName)}
          />
        ) : (
          <div className="w-10 shrink-0" aria-hidden="true" />
        )}
      </div>
      {children}
    </header>
  );
}

export function ModalFooter({
  className,
  contentClassName,
  children,
  ...props
}: React.ComponentProps<"div"> & { contentClassName?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 shrink-0 border-t border-gray-100 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-white/90",
        className,
      )}
      {...props}
    >
      <div className={cn("flex items-center gap-3", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export const ModalPrimaryAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function ModalPrimaryAction({ className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "min-w-[10rem] shrink-0 rounded-xl bg-[#EF8759] px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
