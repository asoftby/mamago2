"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatters/format-price";
import { depositBalanceAction } from "@/app/business/(protected)/billing/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DepositTopUpModalProps {
  balance: number;
  lowBalanceThreshold: number;
  promotionHref: string;
  onClose: () => void;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { amount: 20,  label: "20 BYN" },
  { amount: 50,  label: "50 BYN", recommended: true },
  { amount: 100, label: "100 BYN" },
];

// ── Modal ─────────────────────────────────────────────────────────────────────

export function DepositTopUpModal({ balance, onClose }: DepositTopUpModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number>(50);
  const [custom, setCustom] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = balance <= 0;
  const effectiveAmount = isCustom ? (parseFloat(custom) || 0) : selected;

  function handlePreset(amount: number) {
    setIsCustom(false);
    setSelected(amount);
    setError(null);
  }

  async function handleSubmit() {
    if (effectiveAmount <= 0) return;
    setLoading(true);
    setError(null);

    const result = await depositBalanceAction({ amount: effectiveAmount });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDone(true);
    router.refresh();
  }

  const recommendedLabel = PRESETS.find((p) => p.amount === selected && !isCustom)?.recommended
    ? `${selected} BYN — рекомендуем для старта`
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
          {done ? (
            /* Success state */
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
              <div>
                <p className="text-lg font-semibold text-stone-950">Баланс пополнен</p>
                <p className="mt-1 text-sm text-stone-500">+{formatPrice(effectiveAmount)} зачислено на счёт</p>
              </div>
            </div>
          ) : (
            <>
              {/* Description */}
              <p className="text-sm text-stone-500">
                Баланс используется для продвижения публикаций
              </p>

              {/* Status warning */}
              {isEmpty && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  Продвижение остановлено
                </div>
              )}

              {/* Amount selection */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-700">Выберите сумму</p>

                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.amount}
                      type="button"
                      onClick={() => handlePreset(p.amount)}
                      className={cn(
                        "rounded-2xl border py-3 text-sm font-semibold transition",
                        !isCustom && selected === p.amount
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-4 py-3 transition",
                    isCustom ? "border-stone-900 bg-white shadow-sm" : "border-stone-200 bg-stone-50",
                  )}
                >
                  <span className="text-sm text-stone-400">BYN</span>
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

                {/* Recommended hint */}
                {recommendedLabel && (
                  <p className="text-xs text-stone-400">{recommendedLabel}</p>
                )}

                {/* Error */}
                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer (fixed) ── */}
        <div className="shrink-0 border-t border-stone-100 px-6 py-4 space-y-2">
          {done ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Закрыть
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={effectiveAmount <= 0 || loading}
                onClick={handleSubmit}
                className={cn(
                  "w-full rounded-2xl py-3 text-sm font-semibold transition",
                  effectiveAmount > 0 && !loading
                    ? "bg-stone-900 text-white hover:bg-stone-800"
                    : "cursor-not-allowed bg-stone-100 text-stone-400",
                )}
              >
                {loading
                  ? "Обработка..."
                  : effectiveAmount > 0
                    ? `Пополнить на ${formatPrice(effectiveAmount)}`
                    : "Выберите сумму"}
              </button>
              <p className="text-center text-xs text-stone-400">
                Списание только за действия пользователей
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
