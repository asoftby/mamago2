"use client";

import {
  AlertTriangle,
  Check,
  Info,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LiquidNotificationVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "brand";

const VARIANT = {
  success: {
    tint: "from-emerald-100/75 via-white/65 to-teal-50/55",
    glow: "from-emerald-300/30 via-transparent to-transparent",
    iconWrap: "bg-emerald-600",
    title: "text-emerald-900",
    desc: "text-emerald-800/75",
  },
  error: {
    tint: "from-rose-100/70 via-white/60 to-orange-50/40",
    glow: "from-rose-300/25 via-transparent to-transparent",
    iconWrap: "bg-rose-600",
    title: "text-rose-900",
    desc: "text-rose-800/75",
  },
  warning: {
    tint: "from-amber-100/75 via-white/60 to-yellow-50/45",
    glow: "from-amber-300/28 via-transparent to-transparent",
    iconWrap: "bg-amber-600",
    title: "text-amber-900",
    desc: "text-amber-800/75",
  },
  info: {
    tint: "from-sky-100/72 via-white/62 to-slate-50/50",
    glow: "from-sky-300/26 via-transparent to-transparent",
    iconWrap: "bg-sky-600",
    title: "text-sky-900",
    desc: "text-sky-800/75",
  },
  brand: {
    tint: "from-[#FFE8DC]/90 via-white/65 to-[#FFF5F0]/55",
    glow: "from-[#EF8759]/22 via-transparent to-transparent",
    iconWrap: "bg-[#EF8759]",
    title: "text-neutral-900",
    desc: "text-neutral-600",
  },
} as const;

function VariantIcon({ variant }: { variant: LiquidNotificationVariant }) {
  const className = "size-[18px] stroke-[2.4px] text-white";
  switch (variant) {
    case "success":
      return <Check className={className} aria-hidden />;
    case "error":
      return <XCircle className={className} aria-hidden />;
    case "warning":
      return <AlertTriangle className={className} aria-hidden />;
    case "info":
      return <Info className={className} aria-hidden />;
    default:
      return <Sparkles className={className} aria-hidden />;
  }
}

export type LiquidNotificationProps = {
  variant: LiquidNotificationVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  compact?: boolean;
};

/**
 * Glass-style in-app / toast surface. Used by `src/lib/toast` and UI Lab previews.
 */
export function LiquidNotification({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  onClose,
  compact = false,
}: LiquidNotificationProps) {
  const v = VARIANT[variant];

  return (
    <div
      className={cn(
        "relative isolate flex w-full max-w-[min(100vw-1.5rem,420px)] items-center gap-3 overflow-hidden",
        "border border-white/50 bg-white/60 shadow-[0_12px_36px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl",
        "bg-gradient-to-br",
        v.tint,
        compact ? "rounded-full px-3 py-2.5" : "rounded-[28px] px-4 py-3",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/45 to-transparent"
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-[55%] -left-[18%] h-[120%] w-[70%] rounded-full opacity-90 blur-2xl",
          "bg-gradient-to-tr",
          v.glow,
        )}
        aria-hidden
      />

      <div
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
          v.iconWrap,
        )}
      >
        <VariantIcon variant={variant} />
      </div>

      <div className="relative min-w-0 flex-1">
        <p className={cn("text-sm font-medium leading-snug", v.title)}>{title}</p>
        {description ? (
          <p className={cn("mt-0.5 text-xs leading-snug", v.desc)}>{description}</p>
        ) : null}
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "mt-2 inline-flex max-w-full items-center rounded-lg px-2 py-1 text-left text-xs font-semibold",
              "text-neutral-800 underline decoration-neutral-400/80 underline-offset-2",
              "transition-colors hover:text-neutral-950 hover:decoration-neutral-600",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/35 focus-visible:ring-offset-1",
            )}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full",
            "border border-white/60 bg-white/45 text-neutral-700 backdrop-blur-md",
            "shadow-sm transition-colors hover:bg-white/75 hover:text-neutral-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/40 focus-visible:ring-offset-1",
          )}
        >
          <X className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
