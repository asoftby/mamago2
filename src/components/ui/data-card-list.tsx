import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Мобильное карточное представление для операционных CRUD-таблиц
 * (Стратегия B из аудита адаптивности). Использовать вместе с <table>,
 * обёрнутым в TableContainer и скрытым на мобильных через `hidden md:block`,
 * а сам DataCardList — через `md:hidden`. Оба представления должны читать
 * один и тот же массив данных и вызывать одни и те же обработчики.
 */
export function DataCardList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-3 md:hidden", className)} {...props}>
      {children}
    </div>
  );
}

export const DataCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border border-gray-200 bg-white p-4 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
DataCard.displayName = "DataCard";

export interface DataCardHeaderProps {
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

/** Заголовок карточки: название сущности слева, статус-бейдж справа. */
export function DataCardHeader({ title, badge, subtitle, className }: DataCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="break-words font-medium text-gray-900">{title}</div>
        {subtitle ? <div className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</div> : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

export interface DataCardRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

/** Строка "лейбл: значение". Ничего не рендерит, если value пустое — пустые поля не показываем. */
export function DataCardRow({ label, value, className }: DataCardRowProps) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-sm", className)}>
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 truncate text-right text-gray-700">{value}</span>
    </div>
  );
}

/** Блок с полями карточки — заголовок сверху, поля снизу с отступом. */
export function DataCardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-2 space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

/** Ряд действий: основное действие + доп. действия (напр. dropdown), минимум 40x40px зона нажатия. */
export function DataCardActions({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}
