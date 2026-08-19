"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/formatters/format-price";
import type { BoostOptionId } from "@/lib/billing/boostOptions";
import { purchaseOfferBoostAction } from "./actions";

type Option = { id: BoostOptionId; durationDays: number; price: number; currency: "BYN" };

export function BoostPurchaseClient({
  offerId,
  options,
}: {
  offerId: string;
  options: Option[];
}) {
  const [selectedId, setSelectedId] = useState<BoostOptionId | null>(options[0]?.id ?? null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Покупка Boost пока недоступна: цены first PROD ещё не активированы владельцем.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => { setSelectedId(option.id); setMessage(null); }}
            className={`rounded-2xl border p-4 text-left ${selectedId === option.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white"}`}
          >
            <span className="block text-sm font-semibold">{option.durationDays} дн.</span>
            <span className="mt-1 block text-lg font-bold">{formatPrice(option.price)}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-600">
        Цена определяется сервером. После подтверждения Boost и списание появятся атомарно одной операцией.
      </p>
      {message ? <p className="rounded-xl bg-stone-100 p-3 text-sm text-stone-800">{message}</p> : null}
      <button
        type="button"
        disabled={!selectedId || isPending}
        onClick={() => startTransition(async () => {
          if (!selectedId) return;
          const result = await purchaseOfferBoostAction({ offerId, optionId: selectedId, requestKey });
          if (result.ok) {
            setMessage(result.idempotentReplay ? "Boost уже был куплен этим запросом." : "Boost активирован.");
          } else {
            setMessage(result.error);
            setRequestKey(crypto.randomUUID());
          }
        })}
        className="w-full rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Проверяем…" : "Подтвердить покупку Boost"}
      </button>
    </div>
  );
}
