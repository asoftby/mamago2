"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BYN_SYMBOL, formatPrice } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DepositTopUpModalProps {
  balance: number;
  lowBalanceThreshold: number;
  promotionHref: string;
  onClose: () => void;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { amount: 20 },
  { amount: 50, recommended: true },
  { amount: 100 },
];

// ── Modal ─────────────────────────────────────────────────────────────────────

export function DepositTopUpModal({ balance, onClose }: DepositTopUpModalProps) {
  const [selected, setSelected] = useState<number>(50);
  const [custom, setCustom] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const isEmpty = balance <= 0;
  const effectiveAmount = isCustom ? (parseFloat(custom) || 0) : selected;

  function handlePreset(amount: number) {
    setIsCustom(false);
    setSelected(amount);
  }

  const recommendedLabel = PRESETS.find((p) => p.amount === selected && !isCustom)?.recommended
    ? (
        <>
          {renderCurrencyText(formatPrice(selected, { hideZero: true }), { iconSize: "sm" })}{" "}
          — рекомендуем для старта
        </>
      )
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-[520px] flex-col rounded-t-[20px] bg-white shadow-2xl sm:rounded-[20px] max-h-[90vh]">

        {/* ── Header (fixed) ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-6 py-4">
          <p className="text-base font-semibold text-stone-950">Пополнить баланс</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Description */}
          <p className="text-sm text-stone-500">
            Баланс используется для продвижения публикаций
          </p>

          {isEmpty && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Продвижение остановлено
            </div>
          )}

          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              Онлайн-пополнение скоро вернется
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Пока что самостоятельное пополнение отключено. Для зачисления средств свяжитесь с менеджером mamaGo или support@mamago.by.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-stone-700">Рекомендованная сумма</p>

            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.amount}
                  type="button"
                  onClick={() => handlePreset(p.amount)}
                  className={cn(
                    "rounded-2xl border py-3 text-sm font-semibold transition",
                    !isCustom && selected === p.amount
                      ? "border-stone-400 bg-stone-100 text-stone-900"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
                  )}
                >
                  {renderCurrencyText(formatPrice(p.amount, { hideZero: true }), { iconSize: "sm" })}
                </button>
              ))}
            </div>

            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-4 py-3 transition",
                isCustom ? "border-stone-300 bg-white shadow-sm" : "border-stone-200 bg-stone-50",
              )}
            >
              <span className="text-sm text-stone-400">
                {renderCurrencyText(BYN_SYMBOL, { iconSize: "sm" })}
              </span>
              <input
                type="number"
                min={1}
                placeholder="Своя сумма"
                value={custom}
                onFocus={() => setIsCustom(true)}
                onChange={(e) => setCustom(e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
              />
            </div>

            {recommendedLabel && (
              <p className="text-xs text-stone-400">{recommendedLabel}</p>
            )}
          </div>
        </div>

        {/* ── Footer (fixed) ── */}
        <div className="shrink-0 border-t border-stone-100 px-6 py-4 space-y-2">
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl bg-stone-100 py-3 text-sm font-semibold text-stone-400"
          >
            {effectiveAmount > 0
              ? `Пополнение на ${formatPrice(effectiveAmount, { hideZero: true })} скоро будет доступно`
              : "Онлайн-пополнение скоро будет доступно"}
          </button>
          <p className="text-center text-xs text-stone-400">
            До подключения payment provider пополнение выполняется только через менеджера.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
}
