"use client";

import { Cake, Clock, Star } from "lucide-react";

interface BirthdayQuizIntroProps {
  onStart: () => void;
}

export function BirthdayQuizIntro({ onStart }: BirthdayQuizIntroProps) {
  return (
    <div className="max-w-lg mx-auto text-center space-y-8 py-8">
      {/* Hero */}
      <div className="space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-orange-100 mx-auto">
          <Cake className="h-8 w-8 text-[#EF8759]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
          Организовать детский<br />день рождения
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Подберём площадку, аниматоров, торт и готовые предложения бизнеса за 4 коротких шага
        </p>
      </div>

      {/* Value points */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: "🎂", label: "Для любого возраста" },
          { icon: "💰", label: "Под разный бюджет" },
          { icon: "📍", label: "Предложения в Минске" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-border p-3 space-y-1.5">
            <span className="text-2xl">{item.icon}</span>
            <p className="text-xs text-muted-foreground leading-snug">{item.label}</p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div>
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-[#EF8759] text-white font-semibold py-4 text-base hover:bg-[#e07848] transition-colors shadow-sm"
        >
          Начать подбор
        </button>
      </div>

      {/* Social proof */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <span>Более 200 предложений от проверенных организаторов</span>
      </div>
    </div>
  );
}
