"use client";

import { GraduationCap, PartyPopper, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferKind } from "./WizardPlayground";

interface TypeOption {
  value: NonNullable<OfferKind>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: TypeOption[] = [
  {
    value: "course",
    label: "Курс / занятия",
    description: "Секции, кружки, лагеря и смены для детей",
    icon: GraduationCap,
  },
  {
    value: "birthday",
    label: "Детский праздник",
    description: "Готовая программа дня рождения или праздник под ключ",
    icon: PartyPopper,
  },
  {
    value: "service",
    label: "Услуга",
    description: "Отдельная услуга: фотограф, аниматор, декор, торт и др.",
    icon: Sparkles,
  },
];

interface Props {
  value: OfferKind;
  onChange: (value: NonNullable<OfferKind>) => void;
}

export function WizardStep1Type({ value, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Тип предложения</h2>
        <p className="text-sm text-muted-foreground">
          Что именно предлагается пользователям?
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "w-full text-left rounded-xl border px-5 py-4 transition-all duration-150",
                "flex items-start gap-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/40 focus-visible:ring-offset-2",
                isSelected
                  ? "border-[#EF8759] bg-[#EF8759]/[0.06] shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm hover:-translate-y-px",
              )}
            >
              {/* Icon */}
              <span
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                  isSelected ? "bg-[#EF8759]/15" : "bg-gray-100",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isSelected ? "text-[#EF8759]" : "text-gray-500",
                  )}
                />
              </span>

              {/* Text */}
              <span className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block font-semibold text-sm leading-snug mb-0.5",
                    isSelected ? "text-[#EF8759]" : "text-gray-900",
                  )}
                >
                  {opt.label}
                </span>
                <span className="block text-sm text-muted-foreground leading-snug">
                  {opt.description}
                </span>
              </span>

              {/* Selected indicator */}
              <span
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-all",
                  isSelected
                    ? "border-[#EF8759] bg-[#EF8759]"
                    : "border-gray-300 bg-white",
                )}
              />
            </button>
          );
        })}
      </div>

      {!value && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          Выберите тип, чтобы продолжить
        </p>
      )}
    </div>
  );
}
