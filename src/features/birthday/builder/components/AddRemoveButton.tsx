"use client";

import { useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export type AddRemoveVariant = "addon" | "venue";

interface AddRemoveButtonProps {
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  conflict?: boolean;
  variant?: AddRemoveVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Override default labels (e.g. "Добавить в праздник", "Выбрать площадку") */
  labels?: { default?: string; selected?: string; hover?: string };
}

const LABELS = {
  addon: {
    default: "Добавить",
    selected: "Добавить",
    hover: "Убрать",
  },
  venue: {
    default: "Выбрать",
    selected: "Добавлено",
    hover: "Убрать",
  },
} as const;

export function AddRemoveButton({
  selected,
  onClick,
  disabled = false,
  conflict = false,
  variant = "addon",
  size = "sm",
  className,
  labels: labelsOverride,
}: AddRemoveButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const canHover = useMediaQuery("(hover: hover)"); // false on touch devices

  const labels = { ...LABELS[variant], ...labelsOverride };
  const showHoverRemove = selected && isHovered && canHover && !disabled && !conflict;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onClick(e);
  };

  const sizeClasses = {
    sm: "rounded-lg px-3 py-1.5 text-xs",
    md: "rounded-xl px-4 py-2.5 text-sm",
    lg: "rounded-2xl px-6 py-4 text-base",
  };

  if (conflict) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled
        className={cn(
          "flex items-center justify-center font-semibold transition-all",
          "bg-red-500 text-white cursor-not-allowed",
          "active:scale-[0.98]",
          sizeClasses[size],
          className
        )}
      >
        Конфликт
      </button>
    );
  }

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex items-center justify-center font-semibold transition-all",
          "bg-muted text-muted-foreground cursor-not-allowed",
          sizeClasses[size],
          className
        )}
      >
        Несовместимо
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerEnter={() => canHover && setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      className={cn(
        "flex items-center justify-center font-semibold transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759] focus-visible:ring-offset-2",
        "active:scale-[0.98]",
        sizeClasses[size],
        selected && !showHoverRemove
          ? "bg-[#EF8759] text-white"
          : showHoverRemove
            ? "bg-amber-50 border-2 border-amber-300 text-amber-800 hover:bg-amber-100"
            : "bg-white border border-border text-foreground hover:border-[#EF8759] hover:bg-orange-50",
        className
      )}
    >
      {showHoverRemove ? labels.hover : selected ? labels.selected : labels.default}
    </button>
  );
}
