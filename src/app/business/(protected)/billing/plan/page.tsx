import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { EMPTY_BILLING_STATE, formatDate } from "@/lib/business/billing";
import { formatPrice } from "@/lib/formatters/format-price";
import { CheckCircle, CreditCard, Info } from "lucide-react";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { Button } from "@/components/ui/button";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";

export default async function BillingPlanPage() {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const plan = EMPTY_BILLING_STATE.plan;
  const paymentMethod = EMPTY_BILLING_STATE.paymentMethod;
  const planHistory = EMPTY_BILLING_STATE.planHistory;
  console.log("[API] real data used", {
    endpoint: "business-billing-plan",
    empty: plan === null,
  });

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Billing"
        title="Тариф и подписка"
        description="Здесь видно, какой план сейчас подключён, что входит в подписку и когда произойдёт следующее списание."
      />

      {!plan ? (
        <BusinessEmptyState
          icon={<CreditCard className="h-7 w-7" />}
          title="Тариф пока не подключён"
          description="Реальная биллинговая интеграция ещё не настроена. Здесь появятся тариф, способ оплаты и история продлений после подключения провайдера."
        />
      ) : (
        <>

      <BusinessSurfaceCard className="p-6 md:p-7">
        <h2 className="mb-6 text-xl font-semibold tracking-tight text-stone-950">
          Текущий тариф
        </h2>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-stone-950">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <BusinessChip tone="success">Активен</BusinessChip>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-stone-500">Стоимость</p>
                <p className="text-lg font-semibold text-stone-950">
                  {formatPrice(plan.price)} /{" "}
                  {plan.period === "month" ? "месяц" : "год"}
                </p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Следующее списание</p>
                <p className="text-lg font-semibold text-stone-950">
                  {plan.nextBillingDate ? formatDate(plan.nextBillingDate) : "Не запланировано"}
                </p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Автопродление</p>
                <p className="text-lg font-semibold text-stone-950">
                  {plan.autoRenewal ? "Включено" : "Выключено"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
              <p className="mb-2 text-sm text-stone-500">Способ оплаты</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white">
                  <CreditCard className="w-5 h-5 text-stone-600" />
                </div>
                <div>
                  <p className="font-medium text-stone-950">
                    {paymentMethod ? `${paymentMethod.brand} •••• ${paymentMethod.last4}` : "Не подключён"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {paymentMethod ? `Истекает ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}` : "Способ оплаты не подключён"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="justify-center rounded-2xl bg-stone-900 hover:bg-stone-800">
                Изменить тариф
              </Button>
              <Button
                variant="outline"
                className="justify-center rounded-2xl border-stone-200 bg-white hover:bg-stone-50"
              >
                Обновить способ оплаты
              </Button>
            </div>
          </div>
        </div>
      </BusinessSurfaceCard>

      <BusinessSurfaceCard className="p-6 md:p-7">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-stone-950">
          Возможности тарифа
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {plan.features.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-[22px] border border-stone-200/80 bg-stone-50/70 px-4 py-4"
            >
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span className="text-stone-700">{feature}</span>
            </div>
          ))}
        </div>
      </BusinessSurfaceCard>

      <BusinessSurfaceCard className="overflow-hidden p-0">
        <div className="px-6 pb-0 pt-6 md:px-7">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-stone-950">
            История продлений
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50/90">
              <tr className="border-b border-stone-200">
                <th className="px-5 py-3 text-left text-sm font-medium text-stone-500">
                  Дата
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-stone-500">
                  Операция
                </th>
                <th className="px-5 py-3 text-right text-sm font-medium text-stone-500">
                  Сумма
                </th>
                <th className="px-5 py-3 text-center text-sm font-medium text-stone-500">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {planHistory.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-stone-100 transition-colors hover:bg-stone-50/70"
                >
                  <td className="px-5 py-4 text-sm text-stone-950">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">
                    {item.operation}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-medium text-stone-950">
                    {formatPrice(item.amount)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <TransactionStatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BusinessSurfaceCard>

      <BusinessSurfaceCard tone="accent" className="p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900">
            <p className="mb-1 font-medium">
              Следующее автосписание: {plan.nextBillingDate ? formatDate(plan.nextBillingDate) : "не запланировано"}
            </p>
            <p className="text-blue-700">
              Вы можете изменить тариф или отключить автопродление до даты
              продления.
            </p>
          </div>
        </div>
      </BusinessSurfaceCard>
        </>
      )}
    </div>
  );
}
