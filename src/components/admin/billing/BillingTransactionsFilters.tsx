"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select";

const TYPE_OPTIONS: FilterSelectOption[] = [
  { value: "SUBSCRIPTION_CHARGE", label: "Подписка" },
  { value: "SUBSCRIPTION_RENEWAL", label: "Продление" },
  { value: "DEPOSIT_TOPUP", label: "Пополнение" },
  { value: "LEAD_CHARGE", label: "Лид" },
  { value: "PROMOTION_CHARGE", label: "Продвижение" },
  { value: "REFUND", label: "Возврат" },
  { value: "MANUAL_ADJUSTMENT", label: "Корректировка" },
];

const STATUS_OPTIONS: FilterSelectOption[] = [
  { value: "SUCCEEDED", label: "Успешно" },
  { value: "FAILED", label: "Ошибка" },
  { value: "PENDING", label: "В обработке" },
  { value: "CANCELED", label: "Отменено" },
];

export function BillingTransactionsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "";
  const status = searchParams.get("status") ?? "";

  const push = useCallback(
    (key: string, next: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next) p.set(key, next);
      else p.delete(key);
      const q = p.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
        <FilterSelect
          value={type}
          placeholder="Все типы"
          options={TYPE_OPTIONS}
          onChange={(v) => push("type", v)}
        />
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
        <FilterSelect
          value={status}
          placeholder="Все статусы"
          options={STATUS_OPTIONS}
          onChange={(v) => push("status", v)}
        />
      </div>
    </div>
  );
}
