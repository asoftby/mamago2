"use client";

import * as React from "react";
import { CloseIcon } from "@/components/ui/close-icon";
import { cn } from "@/lib/utils";

export const ModalCloseButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "default" | "touch" }
>(function ModalCloseButton({ className, size = "default", ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "touch" ? "h-11 w-11" : "h-10 w-10",
        "bg-white text-neutral-600 shadow-sm",
        "transition-colors hover:bg-neutral-50 hover:text-neutral-900",
        "z-[80] cursor-pointer touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
        className,
      )}
      aria-label="Закрыть"
      {...props}
    >
      <CloseIcon />
    </button>
  );
});
