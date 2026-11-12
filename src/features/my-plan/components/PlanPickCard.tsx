"use client";

import type { ReactNode } from "react";
import { Check, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { PLAN_FOCUS } from "./v3/planChipStyles";

/**
 * Shared suggestion card for guest day-plan results and authenticated
 * «Подборка для вас» (PlanPicksScreen). Keep both surfaces identical.
 *
 * Layout: title → address → date · time · price, CTA right-aligned.
 */
export function PlanPickCard({
  title,
  coverImageUrl,
  address,
  date,
  time,
  price,
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
  address?: string | null;
  date?: string | null;
  time?: string | null;
  /** Normalized UI price with BYN symbol, or free-label text. */
  price?: string | null;
  adding?: boolean;
  inPlan?: boolean;
  onAdd: () => void;
  onRemove?: () => void;
  isSaved?: boolean;
  saving?: boolean;
  onSave?: () => void;
}) {
  const metaParts: ReactNode[] = [];
  if (date) metaParts.push(date);
  if (time) metaParts.push(time);
  if (price) {
    metaParts.push(
      price === "Бесплатно" ? (
        price
      ) : (
        <span key="price" className="inline-flex items-baseline gap-[0.15em]">
          {renderCurrencyText(price, { iconSize: "sm" })}
        </span>
      ),
    );
  }

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
        {address ? (
          <p className="m-0 mt-1 truncate text-[13px] text-[var(--mp-tx2)]">{address}</p>
        ) : null}
        {metaParts.length > 0 ? (
          <p className="mp-font-meta m-0 mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-0 text-[11px] tracking-[.02em] text-[var(--mp-tx2)]">
            {metaParts.map((part, i) => (
              <span key={i} className="inline-flex min-w-0 items-baseline">
                {i > 0 ? <span className="mx-1.5 shrink-0" aria-hidden>·</span> : null}
                {part}
              </span>
            ))}
          </p>
        ) : null}
        <div className="mt-2.5 flex items-center justify-start gap-2">
          {inPlan ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={!onRemove}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--mp-line-strong)] bg-transparent px-[18px] text-[14px] font-semibold text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-tx)] disabled:opacity-60"
            >
              <Check className="h-4 w-4 shrink-0 text-[var(--mp-ac)]" strokeWidth={2.5} aria-hidden />
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
