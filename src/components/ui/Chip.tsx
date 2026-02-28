"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: React.ReactNode;
}

export function Chip({ active, children, className, ...props }: ChipProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-full px-4 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 interactive",
        active
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-white border border-border text-foreground hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
