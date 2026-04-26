"use client";

import { type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StateBlockVariant = "loading" | "empty" | "error" | "success" | "info";

export interface StateBlockAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "ghost";
  disabled?: boolean;
}

export interface StateBlockProps {
  variant: StateBlockVariant;
  title?: string;
  description?: string;
  /** Override default icon */
  icon?: ReactNode;
  /** Primary CTA */
  action?: StateBlockAction;
  /** Secondary CTA */
  secondaryAction?: StateBlockAction;
  /** Additional content below description */
  children?: ReactNode;
  /** Compact mode: less padding, smaller text */
  compact?: boolean;
  className?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  StateBlockVariant,
  {
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    descColor: string;
    defaultTitle: string;
    defaultDesc: string;
    DefaultIcon: React.ComponentType<{ className?: string }>;
  }
> = {
  loading: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    iconColor: "text-gray-400",
    titleColor: "text-gray-700",
    descColor: "text-gray-500",
    defaultTitle: "Загрузка...",
    defaultDesc: "Пожалуйста, подождите",
    DefaultIcon: ({ className }) => (
      <Loader2 className={cn("animate-spin", className)} />
    ),
  },
  empty: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    iconColor: "text-gray-300",
    titleColor: "text-gray-700",
    descColor: "text-gray-500",
    defaultTitle: "Ничего не найдено",
    defaultDesc: "Здесь пока нет данных",
    DefaultIcon: ({ className }) => <SearchX className={className} />,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-400",
    titleColor: "text-red-800",
    descColor: "text-red-600",
    defaultTitle: "Произошла ошибка",
    defaultDesc: "Не удалось загрузить данные",
    DefaultIcon: ({ className }) => <AlertCircle className={className} />,
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    iconColor: "text-green-500",
    titleColor: "text-green-800",
    descColor: "text-green-600",
    defaultTitle: "Готово",
    defaultDesc: "Действие выполнено успешно",
    DefaultIcon: ({ className }) => <CheckCircle2 className={className} />,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-400",
    titleColor: "text-blue-800",
    descColor: "text-blue-600",
    defaultTitle: "Информация",
    defaultDesc: "",
    DefaultIcon: ({ className }) => <Info className={className} />,
  },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("animate-pulse space-y-3", compact ? "py-4" : "py-8")}>
      <div className="mx-auto h-4 w-32 rounded bg-gray-200" />
      <div className="mx-auto h-3 w-48 rounded bg-gray-200" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StateBlock({
  variant,
  title,
  description,
  icon,
  action,
  secondaryAction,
  children,
  compact = false,
  className,
}: StateBlockProps) {
  const config = VARIANT_CONFIG[variant];
  const { DefaultIcon } = config;

  const resolvedTitle = title ?? config.defaultTitle;
  const resolvedDesc = description ?? config.defaultDesc;

  // Loading uses skeleton animation instead of icon
  if (variant === "loading" && !icon && !title) {
    return (
      <div
        className={cn(
          "rounded-lg border",
          config.bg,
          config.border,
          compact ? "px-4 py-4" : "px-6 py-8",
          className,
        )}
      >
        <LoadingSkeleton compact={compact} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border",
        config.bg,
        config.border,
        compact ? "px-4 py-4" : "px-6 py-10",
        className,
      )}
    >
      <div className={cn("flex flex-col items-center text-center", compact ? "gap-2" : "gap-3")}>
        {/* Icon */}
        <div className={cn(config.iconColor, compact ? "h-6 w-6" : "h-8 w-8")}>
          {icon ?? (
            <DefaultIcon
              className={cn("h-full w-full", variant === "loading" && "animate-spin")}
            />
          )}
        </div>

        {/* Text */}
        <div className={cn("space-y-1", compact ? "max-w-xs" : "max-w-sm")}>
          {resolvedTitle && (
            <p
              className={cn(
                "font-medium",
                compact ? "text-sm" : "text-base",
                config.titleColor,
              )}
            >
              {resolvedTitle}
            </p>
          )}
          {resolvedDesc && (
            <p
              className={cn(
                compact ? "text-xs" : "text-sm",
                config.descColor,
              )}
            >
              {resolvedDesc}
            </p>
          )}
        </div>

        {/* Children */}
        {children && <div className="w-full">{children}</div>}

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action && (
              <Button
                size={compact ? "sm" : "default"}
                variant={action.variant ?? "default"}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                size={compact ? "sm" : "default"}
                variant={secondaryAction.variant ?? "outline"}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function LoadingBlock(props: Omit<StateBlockProps, "variant">) {
  return <StateBlock variant="loading" {...props} />;
}

export function EmptyBlock(props: Omit<StateBlockProps, "variant">) {
  return <StateBlock variant="empty" {...props} />;
}

export function ErrorBlock(props: Omit<StateBlockProps, "variant">) {
  return <StateBlock variant="error" {...props} />;
}

export function SuccessBlock(props: Omit<StateBlockProps, "variant">) {
  return <StateBlock variant="success" {...props} />;
}

export function InfoBlock(props: Omit<StateBlockProps, "variant">) {
  return <StateBlock variant="info" {...props} />;
}
