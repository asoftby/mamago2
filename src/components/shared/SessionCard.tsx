"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SessionCardProps {
  /** Маленький текст сверху (день недели, возрастной диапазон и т.п.) */
  kicker?: string;
  /** Подсвечивает карточку как ближайшую */
  isNearest?: boolean;
  /** Основная строка — дата или название смены */
  title: string;
  /** Вспомогательная строка — время, цена */
  subtitle?: string;
  /** Текст кнопки CTA (undefined — кнопка не отображается) */
  primaryLabel?: string;
  primaryHref?: string;
  /** Если true — вместо CTA показывается «В лист ожидания» */
  primaryDisabled?: boolean;
  onPrimary?: () => void;
  onPlan?: () => void;
  isPlanned?: boolean;
}

export function SessionCard({
  kicker,
  isNearest,
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  primaryDisabled,
  onPrimary,
  onPlan,
  isPlanned = false,
}: SessionCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[18px] border px-6 py-5 transition-colors",
        isNearest
          ? "border-[rgba(232,106,58,0.25)] bg-gradient-to-b from-[#FFE8DC] to-[#FAF7F1]"
          : "border-[rgba(20,18,16,0.10)] bg-[#FAF7F1]",
      )}
    >

      <div className="flex flex-wrap items-center gap-6">
        {/* Info column */}
        <div className="min-w-[180px] flex-1">
          {(kicker || isNearest) && (
            <div className="flex items-center gap-[5px]">
              {kicker && (
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]"
                  style={{ fontFamily: "Menlo, monospace" }}
                >
                  {kicker}
                </span>
              )}
              {isNearest && (
                <span
                  className="flex items-center gap-[5px] text-[10px] font-medium uppercase tracking-[0.1em] text-[#E86A3A]"
                  style={{ fontFamily: "Menlo, monospace" }}
                >
                  {kicker && (
                    <span className="inline-block h-[3px] w-[3px] rounded-full bg-[#E86A3A]" />
                  )}
                  ближайший
                </span>
              )}
            </div>
          )}
          <div className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-[#141210]">
            {title}
          </div>
          {subtitle && (
            <div
              className="mt-1.5 text-[13px] text-[rgba(20,18,16,0.55)]"
              style={{ fontFamily: "Menlo, monospace" }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* CTA column */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {primaryLabel && (
            primaryDisabled ? (
              <button
                type="button"
                disabled
                className="inline-flex h-14 cursor-not-allowed items-center rounded-full border border-[rgba(20,18,16,0.12)] px-6 text-[14px] font-semibold text-[rgba(20,18,16,0.35)]"
              >
                В лист ожидания
              </button>
            ) : (
              <a
                href={primaryHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onPrimary}
                className="inline-flex h-14 items-center gap-2 rounded-full bg-[#E86A3A] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
              >
                {primaryLabel} →
              </a>
            )
          )}
          {onPlan && (
            <button
              type="button"
              onClick={onPlan}
              aria-label={isPlanned ? "В плане" : "Добавить в план"}
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-colors",
                isPlanned
                  ? "border-[#E86A3A] bg-[#FFE8DC] text-[#E86A3A]"
                  : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.45)] hover:border-[#141210] hover:text-[#141210]",
              )}
            >
              <Heart size={20} strokeWidth={1.75} className={isPlanned ? "fill-[#E86A3A]" : ""} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
