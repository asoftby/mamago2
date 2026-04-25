"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SystemNotificationCardProps = {
  /** Иконка слева */
  icon: React.ReactNode;
  /** Заголовок уведомления */
  title: string;
  /** Описание под заголовком */
  description: string;
  /** Текст кнопки действия */
  actionLabel?: string;
  /** Обработчик клика по кнопке действия */
  onAction?: () => void;
  /** Явно отключить primary action */
  actionDisabled?: boolean;
  /** Вторичное действие (текстовая ссылка рядом с primary action) */
  secondaryActionLabel?: string;
  /** Обработчик вторичного действия */
  onSecondaryAction?: () => void;
  /** Обработчик закрытия (крестик) */
  onDismiss?: () => void;
  /** Показывать ли крестик */
  dismissible?: boolean;
  /** Состояние загрузки для кнопки */
  loading?: boolean;
  /** Визуальный тон карточки */
  tone?: "telegram" | "email" | "neutral";
  /** Компактная кнопка (ширина по контенту, по левому краю) вместо на всю ширину */
  actionCompact?: boolean;
  /** Дополнительные CSS классы */
  className?: string;
};

const toneStyles = {
  telegram: {
    container: "border-sky-200 bg-sky-50/90",
    icon: "text-sky-600",
    title: "text-sky-950",
    description: "text-sky-900/85",
  },
  email: {
    container: "border-amber-200 bg-amber-50/90",
    icon: "text-amber-700",
    title: "text-amber-950",
    description: "text-amber-900/85",
  },
  neutral: {
    container: "border-neutral-200 bg-neutral-50",
    icon: "text-neutral-600",
    title: "text-neutral-950",
    description: "text-neutral-700",
  },
};

/**
 * Единый компонент для системных/pinned уведомлений в центре уведомлений.
 * 
 * Принципы:
 * - Цвет = смысл уведомления (tone)
 * - Структура = единая для всех типов
 * - Иконка слева, крестик справа сверху (если dismissible)
 * - Вертикальная структура: title → description → action button
 * - Кнопка: по умолчанию на всю ширину; при actionCompact — компактная, по левому краю текстового блока (колонка под иконкой)
 */
export function SystemNotificationCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  secondaryActionLabel,
  onSecondaryAction,
  onDismiss,
  dismissible = false,
  loading = false,
  tone = "neutral",
  actionCompact = false,
  className,
}: SystemNotificationCardProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-lg border px-4 py-3",
        styles.container,
        className,
      )}
    >
      {/* Крестик справа сверху */}
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-neutral-400 transition-colors hover:bg-white/60 hover:text-neutral-700"
          aria-label="Скрыть"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Основной контент */}
      <div className={cn("flex gap-3", dismissible && "pr-7")}>
        {/* Иконка */}
        <div className={cn("mt-0.5 shrink-0", styles.icon)}>
          {icon}
        </div>

        {/* Текстовый контент */}
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", styles.title)}>
            {title}
          </p>
          <p className={cn("mt-1 text-xs leading-snug sm:text-sm", styles.description)}>
            {description}
          </p>
        </div>
      </div>

      {/* Action button снизу — при actionCompact выравниваем с блоком title/description (как верхний flex gap-3) */}
      {actionLabel && onAction && (
        actionCompact ? (
          <div className={cn("flex gap-3", dismissible && "pr-7")}>
            <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center justify-start gap-3">
              <Button
                type="button"
                size="xs"
                disabled={loading || actionDisabled}
                className="w-auto shrink-0 bg-[#EF8759] text-white hover:bg-[#e07040]"
                onClick={onAction}
              >
                {loading ? "Отправляем" : actionLabel}
              </Button>
              {secondaryActionLabel && onSecondaryAction ? (
                <button
                  type="button"
                  onClick={onSecondaryAction}
                  disabled={loading}
                  className="text-xs font-medium text-neutral-700 underline decoration-neutral-400 underline-offset-2 transition-colors hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {secondaryActionLabel}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={loading || actionDisabled}
            className="w-full bg-[#EF8759] text-white hover:bg-[#e07040]"
            onClick={onAction}
          >
            {loading ? "Отправляем" : actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
