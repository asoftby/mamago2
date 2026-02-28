"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  variant?: "ghost" | "glass";
  active?: boolean;
  className?: string;
}

export function IconButton({
  label,
  onClick,
  children,
  variant = "glass",
  active = false,
  className,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        // Base styles
        "group flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 outline-none interactive",
        "focus-visible:ring-2 focus-visible:ring-primary/40",
        
        // Variant: Glass (default)
        variant === "glass" && [
          "bg-white/90 backdrop-blur-md shadow-md",
          // Hover (desktop): icon color change only (handled by children or specific class)
          // We remove bg-primary hover for now as requested
          "md:hover:scale-105",
          // Active state - handled by specific classes passed in props for now if we want custom behavior
          // or we can keep default active style but user wants only icon to change
          // So we remove default active bg change here if we want full control
          // But let's keep it customizable.
          // The prompt says: "hover changes ONLY icon color", "click heart fills ONLY heart"
          // So we should remove the default bg-primary on hover/active for this variant or create a new one.
          // Let's modify 'glass' to be cleaner or add 'glass-icon'.
          // Let's stick to modifying 'glass' to be neutral on background changes if active is not used for bg.
          
          // Actually, let's make it so hover affects text color (icon) but keeps bg white/glass.
          "md:hover:text-primary", 
          
          // Active press effect
          "active:scale-95",
        ],

        // Variant: Ghost (if needed)
        variant === "ghost" && [
          "bg-transparent hover:bg-black/5",
          active && "text-primary",
        ],

        className
      )}
    >
      {children}
    </button>
  );
}
