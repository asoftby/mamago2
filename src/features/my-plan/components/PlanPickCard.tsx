"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "./v3/planChipStyles";

/**
 * Shared suggestion card for guest day-plan results and authenticated
 * «Подборка для вас» (PlanPicksScreen). Keep both surfaces identical.
 */
export function PlanPickCard({
  title,
  coverImageUrl,
  category,
  meta,
  adding = false,
  inPlan = false,
  onAdd,
  onRemove,
  isSaved = false,
  saving = false,
  onSave,
}: {
  title: string;
  coverImageUrl?: string | null;
  category?: string | null;
  meta?: string | null;
  adding?: boolean;
  inPlan?: boolean;
  onAdd: () => void;
  onRemove?: () => void;
  isSaved?: boolean;
  saving?: boolean;
  onSave?: () => void;
}) {
  return (
    <article className="flex items-start gap-3.5 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-3">
      <span className="flex h-[100px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--mp-soft)]">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="m-0 line-clamp-2 text-[15px] font-semibold leading-[1.25] tracking-[-.01em] text-[var(--mp-tx)] [overflow-wrap:anywhere]">
          {title}
        </h3>
        {category ? <p className="m-0 mt-1 truncate text-[13px] text-[var(--mp-tx2)]">{category}</p> : null}
        {meta ? <p className="mp-font-meta m-0 mt-0.5 truncate text-[11px] tracking-[.02em] text-[var(--mp-tx2)]">{meta}</p> : null}
        <div className="mt-2.5 flex items-center gap-2">
          {inPlan ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={!onRemove}
              className="h-11 rounded-full border border-[var(--mp-line-strong)] bg-transparent px-[18px] text-[14px] font-semibold text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-tx)] disabled:opacity-60"
            >
              В плане
            </button>
          ) : (
            <button
              type="button"
              disabled={adding}
              onClick={onAdd}
              className="h-11 rounded-full bg-[var(--mp-tx)] px-[18px] text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {adding ? "Добавляем…" : "В план"}
            </button>
          )}
          {onSave ? (
            <button
              type="button"
              aria-label={isSaved ? "Сохранено в идеи" : "Сохранить в идеи"}
              aria-pressed={isSaved}
              disabled={saving}
              onClick={onSave}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full bg-[var(--mp-ac-soft)] text-[var(--mp-ac-dark)] transition-colors hover:bg-brand-soft-hover disabled:opacity-60",
                PLAN_FOCUS,
              )}
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={2} fill={isSaved ? "currentColor" : "none"} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
