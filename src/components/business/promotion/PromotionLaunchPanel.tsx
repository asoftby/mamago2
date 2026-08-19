"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BYN_SYMBOL, formatPrice, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { PromotionPublicationType } from "@prisma/client";
import { PROMOTION_MIN_BUDGET, PROMOTION_MAX_BUDGET } from "@/lib/promotion/shared";
import {
  createPromotionAction,
} from "@/app/business/(protected)/promotion/actions";

// ── Estimation ────────────────────────────────────────────────────────────────

function getEstimation(amount: number) {
  return {
    saves:  { min: Math.round(amount * 0.8),  max: Math.round(amount * 1.6) },
    clicks: { min: Math.round(amount * 0.3),  max: Math.round(amount * 0.6) },
  };
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { amount: 20,  hint: "≈ 16–32 сохранений" },
  { amount: 50,  hint: "≈ 40–80 сохранений", recommended: true },
  { amount: 100, hint: "≈ 80–160 сохранений" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ValueBlock() {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
        Как это работает
      </p>
      <ul className="space-y-2 text-sm text-stone-600">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-stone-300">→</span>
          Вы платите только за реальные действия — сохранения и клики
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-stone-300">→</span>
          Показы и просмотры бесплатны
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-stone-300">→</span>
          Бюджет не превышается — остановить можно в любой момент
        </li>
      </ul>
      <div className="rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-500">
        {renderCurrencyText(
          normalizeUiCurrencyText("~0.5 BYN за сохранение · ~1 BYN за заинтересованного клиента"),
          { iconSize: "sm" },
        )}
      </div>
    </div>
  );
}

function EstimationBlock({ amount }: { amount: number }) {
  if (amount <= 0 || !Number.isFinite(amount)) return null;
  const est = getEstimation(amount);
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
        На {formatPrice(amount)} вы получите примерно
      </p>
      <p className="text-sm text-emerald-800">— {est.saves.min}–{est.saves.max} сохранений в план</p>
      <p className="text-sm text-emerald-800">— {est.clicks.min}–{est.clicks.max} кликов по CTA</p>
    </div>
  );
}

function InsufficientBalanceBlock({
  depositHref,
}: {
  depositHref: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">Недостаточно средств</p>
      <p className="text-sm text-amber-800">
        Пополните баланс, чтобы запустить продвижение и начать получать лиды.
      </p>
      <Link
        href={depositHref}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
      >
        Пополнить баланс
      </Link>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export interface PromotionLaunchPanelProps {
  publicationId: string;
  publicationType: PromotionPublicationType;
  publicationTitle: string;
  publicationTypeLabel: string;
  /** Current deposit balance — used to gate launch */
  depositBalance: number;
  depositHref: string;
  /** Called after successful launch (e.g. close modal or redirect) */
  onSuccess?: () => void;
  /** If provided, shown as a secondary link after success */
  dashboardHref?: string;
}

type Step = "launch" | "success";

export function PromotionLaunchPanel({
  publicationId,
  publicationType,
  publicationTitle,
  publicationTypeLabel,
  depositBalance,
  depositHref,
  onSuccess,
  dashboardHref,
}: PromotionLaunchPanelProps) {
  const [step, setStep] = useState<Step>("launch");
  const [selected, setSelected] = useState(50);
  const [custom, setCustom] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveAmount = isCustom ? (parseFloat(custom) || 0) : selected;
  const hasBalance = depositBalance >= PROMOTION_MIN_BUDGET;
  const canLaunch = hasBalance && effectiveAmount >= PROMOTION_MIN_BUDGET && effectiveAmount <= PROMOTION_MAX_BUDGET;

  function handlePreset(amount: number) {
    setIsCustom(false);
    setSelected(amount);
    setFeedback(null);
  }

  function handleLaunch() {
    if (!canLaunch) return;
    setFeedback(null);

    startTransition(async () => {
      const result = await createPromotionAction({
        publicationId,
        publicationType,
        budget: effectiveAmount,
      });

      if (!result.ok) {
        setFeedback(result.error ?? "Не удалось запустить продвижение.");
        return;
      }

      setStep("success");
    });
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="space-y-5 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✓
          </div>
          <div>
            <p className="text-xl font-semibold text-stone-950">Продвижение запущено</p>
            <p className="mt-1 text-sm text-stone-500">
              Бюджет {formatPrice(effectiveAmount)} · результаты появятся по мере действий пользователей
            </p>
          </div>
        </div>

        <BusinessSurfaceCard tone="success" className="p-4 text-left space-y-2">
          <p className="text-sm font-medium text-stone-700">Что дальше:</p>
          <ul className="space-y-1.5 text-sm text-stone-600">
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">→</span>
              Сохранения и клики начнут появляться в статистике
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">→</span>
              Вы можете поставить продвижение на паузу в любой момент
            </li>
          </ul>
        </BusinessSurfaceCard>

        <div className="flex flex-col gap-2.5">
          {dashboardHref && (
            <Link
              href={dashboardHref}
              onClick={onSuccess}
              className="w-full rounded-2xl bg-stone-900 px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Перейти в дашборд
            </Link>
          )}
          <button
            type="button"
            onClick={onSuccess}
            className="w-full rounded-2xl border border-stone-200 px-6 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  // ── Launch state ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Publication context */}
      <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
          {publicationTypeLabel}
        </p>
        <p className="mt-1 text-sm font-semibold text-stone-900 line-clamp-2">
          {publicationTitle}
        </p>
      </div>

      {/* Value explanation */}
      <ValueBlock />

      {/* Insufficient balance gate */}
      {!hasBalance ? (
        <InsufficientBalanceBlock depositHref={depositHref} />
      ) : (
        <>
          {/* Budget presets */}
          <div>
            <p className="mb-3 text-sm font-medium text-stone-700">Выберите бюджет</p>
            <div className="grid grid-cols-3 gap-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.amount}
                  type="button"
                  onClick={() => handlePreset(p.amount)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-2xl border px-3 py-3.5 text-center transition",
                    !isCustom && selected === p.amount
                      ? "border-stone-900 bg-stone-900 text-white shadow-sm"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
                  )}
                >
                  {p.recommended && (
                    <span
                      className={cn(
                        "absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                        !isCustom && selected === p.amount
                          ? "bg-white text-stone-900"
                          : "bg-stone-900 text-white",
                      )}
                    >
                      Рекомендуем
                    </span>
                  )}
                  <span className="text-base font-semibold">
                    {renderCurrencyText(formatPrice(p.amount, { hideZero: true }), { iconSize: "sm" })}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-tight",
                      !isCustom && selected === p.amount ? "text-stone-300" : "text-stone-400",
                    )}
                  >
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="mt-2.5">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-3 transition",
                  isCustom ? "border-stone-900 bg-white shadow-sm" : "border-stone-200 bg-stone-50",
                )}
              >
                <span className="text-sm text-stone-400">
                  {renderCurrencyText(BYN_SYMBOL, { iconSize: "sm" })}
                </span>
                <input
                  type="number"
                  min={PROMOTION_MIN_BUDGET}
                  max={PROMOTION_MAX_BUDGET}
                  placeholder="Своя сумма"
                  value={custom}
                  onFocus={() => { setIsCustom(true); setFeedback(null); }}
                  onChange={(e) => setCustom(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
                />
              </div>
              <p className="mt-1.5 text-xs text-stone-400">
                От {formatPrice(PROMOTION_MIN_BUDGET)} до {formatPrice(PROMOTION_MAX_BUDGET)}
              </p>
            </div>
          </div>

          {/* Dynamic estimation */}
          <EstimationBlock amount={effectiveAmount} />

          {/* Error feedback */}
          {feedback && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {feedback}
            </p>
          )}

          {/* CTA */}
          <button
            type="button"
            disabled={!canLaunch || isPending}
            onClick={handleLaunch}
            className={cn(
              "w-full rounded-2xl px-6 py-3.5 text-sm font-semibold transition",
              canLaunch && !isPending
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-100 text-stone-400",
            )}
          >
            {isPending
              ? "Запускаем…"
              : canLaunch
                ? `Запустить на ${formatPrice(effectiveAmount)}`
                : "Выберите бюджет"}
          </button>

          {/* Trust */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {["Бюджет не превышается", "Остановить в любой момент", "Платите только за действия"].map(
              (item) => (
                <span key={item} className="flex items-center gap-1.5 text-xs text-stone-400">
                  <span className="text-emerald-500">✓</span>
                  {item}
                </span>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
