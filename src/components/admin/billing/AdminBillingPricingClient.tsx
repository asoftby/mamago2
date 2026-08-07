"use client";

import { useMemo, useState } from "react";
import type {
  BillingActionPricingType,
  BillingActionRate,
  BillingActionType,
  BillingRateScopeType,
  Plan,
} from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BILLING_ACTION_TITLES,
  BILLING_PRICING_TYPE_LABELS,
  BILLING_SCOPE_LABELS,
  formatBillingActionPeriod,
  formatBillingActionPrice,
} from "@/lib/billing/actionPricing";
import { formatPrice } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { TableContainer } from "@/components/ui/table";

type RateWithNumbers = {
  id: string;
  actionType: BillingActionType;
  scopeType: BillingRateScopeType;
  scopeId: string | null;
  pricingType: BillingActionPricingType;
  fixedAmount: number | null;
  percentRate: number | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  currency: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

type ResolvedPrice = {
  actionType: BillingActionType;
  source: BillingRateScopeType | null;
  rule: RateWithNumbers | null;
};

function toInputDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toRateLike(rate: RateWithNumbers | BillingActionRate) {
  return {
    pricingType: rate.pricingType,
    fixedAmount: rate.fixedAmount,
    percentRate: rate.percentRate,
    minimumAmount: rate.minimumAmount,
    maximumAmount: rate.maximumAmount,
    currency: rate.currency,
  };
}

type GlobalFormState = Record<
  BillingActionType,
  {
    pricingType: BillingActionPricingType;
    fixedAmount: string;
    percentRate: string;
    minimumAmount: string;
    maximumAmount: string;
    startsAt: string;
    endsAt: string;
    reason: string;
    isActive: boolean;
  }
>;

function buildGlobalFormState(rates: RateWithNumbers[]): GlobalFormState {
  const entries = Object.keys(BILLING_ACTION_TITLES) as BillingActionType[];

  return entries.reduce((acc, actionType) => {
    const rate = rates.find((row) => row.actionType === actionType && row.scopeType === "GLOBAL");
    acc[actionType] = {
      pricingType: rate?.pricingType ?? "FREE",
      fixedAmount: rate?.fixedAmount != null ? String(rate.fixedAmount) : "",
      percentRate: rate?.percentRate != null ? String(rate.percentRate) : "",
      minimumAmount: rate?.minimumAmount != null ? String(rate.minimumAmount) : "",
      maximumAmount: rate?.maximumAmount != null ? String(rate.maximumAmount) : "",
      startsAt: toInputDate(rate?.startsAt ?? null),
      endsAt: toInputDate(rate?.endsAt ?? null),
      reason: rate?.reason ?? "",
      isActive: rate?.isActive ?? false,
    };
    return acc;
  }, {} as GlobalFormState);
}

export function AdminBillingPricingClient({
  initialGlobalRates,
  initialBusinessRates,
  initialResolvedPrices,
  businessContext,
  legacyPlans,
}: {
  initialGlobalRates: RateWithNumbers[];
  initialBusinessRates: RateWithNumbers[];
  initialResolvedPrices: ResolvedPrice[];
  businessContext: { id: string; name: string } | null;
  legacyPlans: Array<Plan & { _count: { subscriptions: number } }>;
}) {
  const [globalForm, setGlobalForm] = useState<GlobalFormState>(() => buildGlobalFormState(initialGlobalRates));
  const [businessRates, setBusinessRates] = useState(initialBusinessRates);
  const [resolvedPrices, setResolvedPrices] = useState(initialResolvedPrices);
  const [submittingGlobal, setSubmittingGlobal] = useState<BillingActionType | null>(null);
  const [submittingBusiness, setSubmittingBusiness] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    actionType: "LEAD_CREATED" as BillingActionType,
    pricingType: "FIXED" as BillingActionPricingType,
    fixedAmount: "",
    percentRate: "",
    minimumAmount: "",
    maximumAmount: "",
    startsAt: "",
    endsAt: "",
    reason: "",
    isActive: true,
  });

  const sortedBusinessRates = useMemo(
    () =>
      [...businessRates].sort((a, b) => {
        if (a.actionType !== b.actionType) return a.actionType.localeCompare(b.actionType);
        return (b.startsAt ?? "").localeCompare(a.startsAt ?? "");
      }),
    [businessRates],
  );

  async function refreshBusinessRates() {
    if (!businessContext) return;

    const response = await fetch(`/api/admin/billing/action-rates?businessId=${businessContext.id}`);
    if (!response.ok) return;

    const payload = await response.json();
    setBusinessRates(payload.businessRates);
    setResolvedPrices(payload.resolvedPrices);
  }

  async function saveGlobalRate(actionType: BillingActionType) {
    const form = globalForm[actionType];
    setSubmittingGlobal(actionType);

    try {
      const body = new FormData();
      body.set("scopeType", "GLOBAL");
      body.set("actionType", actionType);
      body.set("pricingType", form.pricingType);
      body.set("fixedAmount", form.fixedAmount);
      body.set("percentRate", form.percentRate);
      body.set("minimumAmount", form.minimumAmount);
      body.set("maximumAmount", form.maximumAmount);
      body.set("startsAt", form.startsAt);
      body.set("endsAt", form.endsAt);
      body.set("reason", form.reason);
      body.set("currency", "BYN");
      body.set("isActive", String(form.isActive));

      const response = await fetch("/api/admin/billing/action-rates", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        throw new Error("Не удалось сохранить глобальное правило");
      }

      toast.success("Глобальная цена обновлена");
      if (businessContext) {
        await refreshBusinessRates();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSubmittingGlobal(null);
    }
  }

  async function saveBusinessRate() {
    if (!businessContext) return;

    setSubmittingBusiness(true);

    try {
      const body = new FormData();
      body.set("scopeType", "BUSINESS");
      body.set("businessId", businessContext.id);
      body.set("actionType", businessForm.actionType);
      body.set("pricingType", businessForm.pricingType);
      body.set("fixedAmount", businessForm.fixedAmount);
      body.set("percentRate", businessForm.percentRate);
      body.set("minimumAmount", businessForm.minimumAmount);
      body.set("maximumAmount", businessForm.maximumAmount);
      body.set("startsAt", businessForm.startsAt);
      body.set("endsAt", businessForm.endsAt);
      body.set("reason", businessForm.reason);
      body.set("currency", "BYN");
      body.set("isActive", String(businessForm.isActive));

      const response = await fetch("/api/admin/billing/action-rates", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        throw new Error("Не удалось сохранить индивидуальное правило");
      }

      toast.success("Индивидуальная цена сохранена");
      setBusinessForm((prev) => ({
        ...prev,
        fixedAmount: "",
        percentRate: "",
        minimumAmount: "",
        maximumAmount: "",
        startsAt: "",
        endsAt: "",
        reason: "",
      }));
      await refreshBusinessRates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSubmittingBusiness(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-xl font-bold text-gray-900">Тарификация</h1>
            <p className="mt-1 text-sm text-gray-600">
              Правила списаний за полезные действия бизнеса
            </p>
          </div>
          <Badge variant="outline" className="border-gray-200 text-gray-700">
            Депозитная модель
          </Badge>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Глобальные цены действий</h2>
          <p className="mt-1 text-sm text-gray-600">
            Системные дефолты, которые применяются, если для бизнеса нет индивидуального правила.
          </p>
        </div>

        <div className="space-y-4">
          {(Object.keys(BILLING_ACTION_TITLES) as BillingActionType[]).map((actionType) => {
            const form = globalForm[actionType];
            return (
              <div key={actionType} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{BILLING_ACTION_TITLES[actionType]}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {form.pricingType === "FREE"
                        ? "Бесплатно"
                        : renderCurrencyText(formatBillingActionPrice({
                            pricingType: form.pricingType,
                            fixedAmount: form.fixedAmount ? Number(form.fixedAmount) : null,
                            percentRate: form.percentRate ? Number(form.percentRate) : null,
                            minimumAmount: form.minimumAmount ? Number(form.minimumAmount) : null,
                            maximumAmount: form.maximumAmount ? Number(form.maximumAmount) : null,
                            currency: "BYN",
                          }))}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], isActive: event.target.checked },
                        }))
                      }
                    />
                    Включено
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Тип цены</span>
                    <select
                      value={form.pricingType}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: {
                            ...prev[actionType],
                            pricingType: event.target.value as BillingActionPricingType,
                          },
                        }))
                      }
                      className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    >
                      {(Object.keys(BILLING_PRICING_TYPE_LABELS) as BillingActionPricingType[]).map((type) => (
                        <option key={type} value={type}>
                          {BILLING_PRICING_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Фиксированная сумма</span>
                    <Input
                      value={form.fixedAmount}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], fixedAmount: event.target.value },
                        }))
                      }
                      placeholder="20"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Процент</span>
                    <Input
                      value={form.percentRate}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], percentRate: event.target.value },
                        }))
                      }
                      placeholder="10"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Минимум</span>
                    <Input
                      value={form.minimumAmount}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], minimumAmount: event.target.value },
                        }))
                      }
                      placeholder="30"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Максимум</span>
                    <Input
                      value={form.maximumAmount}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], maximumAmount: event.target.value },
                        }))
                      }
                      placeholder="100"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Действует с</span>
                    <Input
                      type="date"
                      value={form.startsAt}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], startsAt: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs text-gray-600">
                    <span>Действует до</span>
                    <Input
                      type="date"
                      value={form.endsAt}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], endsAt: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs text-gray-600 md:col-span-2 xl:col-span-1">
                    <span>Комментарий</span>
                    <Input
                      value={form.reason}
                      onChange={(event) =>
                        setGlobalForm((prev) => ({
                          ...prev,
                          [actionType]: { ...prev[actionType], reason: event.target.value },
                        }))
                      }
                      placeholder="Комментарий для администратора"
                    />
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void saveGlobalRate(actionType)}
                    disabled={submittingGlobal === actionType}
                  >
                    {submittingGlobal === actionType ? "Сохраняем..." : "Сохранить правило"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Индивидуальные цены бизнеса</h2>
          <p className="mt-1 text-sm text-gray-600">
            Если у бизнеса есть активное индивидуальное правило, оно имеет приоритет над глобальным.
          </p>
        </div>

        {!businessContext ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
            Откройте страницу контрагента или передайте `?businessId=...`, чтобы настроить индивидуальные условия для конкретного бизнеса.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Бизнес</p>
              <p className="mt-1 text-base font-semibold text-gray-900">{businessContext.name}</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Добавить индивидуальное правило</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Действие</span>
                  <select
                    value={businessForm.actionType}
                    onChange={(event) =>
                      setBusinessForm((prev) => ({
                        ...prev,
                        actionType: event.target.value as BillingActionType,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  >
                    {(Object.keys(BILLING_ACTION_TITLES) as BillingActionType[]).map((type) => (
                      <option key={type} value={type}>
                        {BILLING_ACTION_TITLES[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Тип цены</span>
                  <select
                    value={businessForm.pricingType}
                    onChange={(event) =>
                      setBusinessForm((prev) => ({
                        ...prev,
                        pricingType: event.target.value as BillingActionPricingType,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  >
                    {(Object.keys(BILLING_PRICING_TYPE_LABELS) as BillingActionPricingType[]).map((type) => (
                      <option key={type} value={type}>
                        {BILLING_PRICING_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Фиксированная сумма</span>
                  <Input
                    value={businessForm.fixedAmount}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, fixedAmount: event.target.value }))}
                    placeholder="15"
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Процент</span>
                  <Input
                    value={businessForm.percentRate}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, percentRate: event.target.value }))}
                    placeholder="10"
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Минимум</span>
                  <Input
                    value={businessForm.minimumAmount}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, minimumAmount: event.target.value }))}
                    placeholder="30"
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Максимум</span>
                  <Input
                    value={businessForm.maximumAmount}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, maximumAmount: event.target.value }))}
                    placeholder="100"
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Действует с</span>
                  <Input
                    type="date"
                    value={businessForm.startsAt}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span>Действует до</span>
                  <Input
                    type="date"
                    value={businessForm.endsAt}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600 md:col-span-2 xl:col-span-3">
                  <span>Причина / комментарий</span>
                  <Input
                    value={businessForm.reason}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder="Например: партнёрская скидка до конца месяца"
                  />
                </label>
                <label className="flex items-center gap-2 self-end text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={businessForm.isActive}
                    onChange={(event) => setBusinessForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Активно
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <Button type="button" onClick={() => void saveBusinessRate()} disabled={submittingBusiness}>
                  {submittingBusiness ? "Сохраняем..." : "Сохранить индивидуальное правило"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Применяемые цены</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {resolvedPrices.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-600">
                    Нет активных правил. Если правило не найдено или выключено, действие не тарифицируется.
                  </div>
                ) : (
                  resolvedPrices.map((item) => (
                    <div key={item.actionType} className="flex flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{BILLING_ACTION_TITLES[item.actionType]}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {item.rule ? renderCurrencyText(formatBillingActionPrice(toRateLike(item.rule))) : "Не тарифицируется"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.source && (
                          <Badge variant="outline" className="border-gray-200 text-gray-700">
                            {BILLING_SCOPE_LABELS[item.source]}
                          </Badge>
                        )}
                        {item.rule && (
                          <span className="text-xs text-gray-500">
                            {formatBillingActionPeriod({
                              startsAt: item.rule.startsAt ? new Date(item.rule.startsAt) : null,
                              endsAt: item.rule.endsAt ? new Date(item.rule.endsAt) : null,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Сохранённые индивидуальные правила</h3>
              </div>
              {sortedBusinessRates.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-600">
                  Индивидуальные цены не настроены. Применяются глобальные правила.
                </div>
              ) : (
                <TableContainer minWidthClassName="min-w-[720px]" scrollLabel="Индивидуальные правила ценообразования, таблица">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Действие</th>
                        <th className="px-4 py-3 text-left font-medium">Цена</th>
                        <th className="px-4 py-3 text-left font-medium">Тип цены</th>
                        <th className="px-4 py-3 text-left font-medium">Период</th>
                        <th className="px-4 py-3 text-left font-medium">Статус</th>
                        <th className="px-4 py-3 text-left font-medium">Причина</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedBusinessRates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="px-4 py-3 text-gray-900">{BILLING_ACTION_TITLES[rate.actionType]}</td>
                          <td className="px-4 py-3 text-gray-700">{renderCurrencyText(formatBillingActionPrice(toRateLike(rate)))}</td>
                          <td className="px-4 py-3 text-gray-700">{BILLING_PRICING_TYPE_LABELS[rate.pricingType]}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatBillingActionPeriod({
                              startsAt: rate.startsAt ? new Date(rate.startsAt) : null,
                              endsAt: rate.endsAt ? new Date(rate.endsAt) : null,
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={rate.isActive ? "border-emerald-200 text-emerald-700" : "border-gray-200 text-gray-500"}>
                              {rate.isActive ? "Активно" : "Выключено"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{rate.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableContainer>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Планы доступа</h2>
          <p className="mt-1 text-sm text-gray-600">
            Legacy-раздел. Планы не удалены, но не являются основным сценарием депозитной модели.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {legacyPlans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">{plan.code}</p>
                </div>
                <Badge variant="outline" className="border-gray-200 text-gray-700">
                  {plan._count.subscriptions} подписок
                </Badge>
              </div>
              <p className="mt-4 text-lg font-semibold text-gray-900">{renderCurrencyText(formatPrice(plan.price.toNumber()))}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
