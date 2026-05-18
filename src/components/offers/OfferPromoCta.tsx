"use client";

import { useState, useEffect, useCallback } from "react";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

type PromoCtaData = NonNullable<OfferPageData["promoCta"]>;

interface OfferPromoCtaProps extends PromoCtaData {
  onPrimary?: () => void;
}

/** Live countdown hook — returns "X ДНЕЙ · Y ЧАСОВ" or null when expired */
function useCountdown(promoUntil?: string): string | null {
  const compute = useCallback((): string | null => {
    if (!promoUntil) return null;
    const diff = new Date(promoUntil).getTime() - Date.now();
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const pluralDays = (n: number) =>
      n % 10 === 1 && n % 100 !== 11
        ? "день"
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "дня"
        : "дней";
    const pluralHours = (n: number) =>
      n % 10 === 1 && n % 100 !== 11
        ? "час"
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "часа"
        : "часов";

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ${pluralDays(days)}`);
    if (hours > 0 || days === 0) parts.push(`${hours} ${pluralHours(hours)}`);
    return parts.join(" · ");
  }, [promoUntil]);

  const [label, setLabel] = useState<string | null>(() => compute());

  useEffect(() => {
    const id = setInterval(() => setLabel(compute()), 60_000);
    return () => clearInterval(id);
  }, [compute]);

  return label;
}

/**
 * Promo CTA — editorial full-width conversion block.
 *
 * Структура: таймер (опционально) → большой заголовок с italic-акцентом
 * → подзаголовок → кнопки → trust-линия.
 */
export function OfferPromoCta({
  timerLabel,
  promoUntil,
  headline,
  accentWord,
  subtitle,
  primaryLabel,
  secondaryLabel,
  secondaryHref,
  trustLine,
  onPrimary,
}: OfferPromoCtaProps) {
  const countdown = useCountdown(promoUntil);
  const activeTimerLabel = countdown
    ? `ДО КОНЦА АКЦИИ ${countdown.toUpperCase()}`
    : timerLabel ?? null;

  /* Split headline around the accent word */
  const headlineParts = (() => {
    if (!accentWord || !headline.includes(accentWord)) {
      return [{ text: headline, accent: false }];
    }
    const idx = headline.indexOf(accentWord);
    return [
      { text: headline.slice(0, idx), accent: false },
      { text: accentWord, accent: true },
      { text: headline.slice(idx + accentWord.length), accent: false },
    ].filter((p) => p.text.length > 0);
  })();

  return (
    <section className="overflow-hidden rounded-[32px] bg-[#FBF8F5] px-6 py-14 sm:px-12 sm:py-16 lg:px-20 lg:py-20 text-center">
      {/* Timer */}
      {activeTimerLabel && (
        <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
          {activeTimerLabel}
        </p>
      )}

      {/* Headline */}
      <h2 className="font-[family-name:var(--font-display)] text-[52px] sm:text-[72px] lg:text-[96px] font-normal tracking-[-0.03em] leading-[0.92] text-gray-900 mx-auto max-w-[900px]">
        {headlineParts.map((part, i) =>
          part.accent ? (
            <em key={i} className="not-italic italic text-[#EF8759]">
              {part.text}
            </em>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </h2>

      {/* Subtitle */}
      {subtitle && (
        <p className="mt-7 text-[15px] leading-[1.65] text-gray-500 max-w-[480px] mx-auto">
          {subtitle}
        </p>
      )}

      {/* Buttons */}
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex items-center gap-2 rounded-full bg-[#EF8759] px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#C2522A] active:scale-[0.98]"
        >
          {primaryLabel} <span aria-hidden>→</span>
        </button>

        {secondaryLabel &&
          (secondaryHref ? (
            <a
              href={secondaryHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              {secondaryLabel}
            </a>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              {secondaryLabel}
            </button>
          ))}
      </div>

      {/* Trust line */}
      {trustLine && (
        <p className="mt-5 text-[12px] text-gray-400">{trustLine}</p>
      )}
    </section>
  );
}
