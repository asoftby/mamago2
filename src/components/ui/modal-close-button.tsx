"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModalCloseButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        "border border-neutral-200 bg-white text-neutral-600 shadow-sm",
        "transition-colors hover:bg-neutral-50 hover:text-neutral-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
        className,
      )}
      aria-label="Закрыть"
      {...props}
    >
      <X className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}
