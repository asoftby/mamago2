"use client";

import { Baby, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "child" | "adult";

export interface PlanOnboardingPromoBannerProps {
  variant: Variant;
  onPrimary: () => void;
  onSecondary: () => void;
}

const COPY: Record<
  Variant,
  { title: string; description: string; primary: string; secondary: string }
> = {
  child: {
    title: "Добавьте ребёнка — будем подбирать точнее",
    description:
      "Укажите возраст, и мы покажем события, которые подходят именно вам",
    primary: "Добавить ребёнка",
    secondary: "Не сейчас",
  },
  adult: {
    title: "Расскажите о себе",
    description:
      "Это поможет точнее ранжировать предложения для взрослых",
    primary: "Заполнить профиль",
    secondary: "Позже",
  },
};

/**
 * Единственный onboarding/promo-баннер в «Моем плане» (ребёнок или взрослый — не оба).
 */
export function PlanOnboardingPromoBanner({
  variant,
  onPrimary,
  onSecondary,
}: PlanOnboardingPromoBannerProps) {
  const c = COPY[variant];
  const isChild = variant === "child";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        isChild
          ? "border-[#EF8759]/30 bg-[#EF8759]/5"
          : "border-[rgba(20,18,16,.10)] bg-[#FAF7F1]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isChild ? "bg-[#EF8759]/10" : "bg-neutral-900/[0.06]",
          )}
        >
          {isChild ? (
            <Baby className="h-5 w-5 text-[#EF8759]" aria-hidden />
          ) : (
            <UserRound className="h-5 w-5 text-neutral-700" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 400, lineHeight: 1.2, color: "#141210" }}>{c.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            {c.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrimary}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isChild
                  ? "bg-[#EF8759] text-white hover:bg-[#e07040]"
                  : "bg-neutral-900 text-white hover:bg-neutral-800",
              )}
            >
              {c.primary}
            </button>
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              {c.secondary}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
