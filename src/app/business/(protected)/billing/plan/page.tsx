import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { EMPTY_BILLING_STATE, formatDate } from "@/lib/business/billing";
import { formatPrice } from "@/lib/formatters/format-price";
import { CheckCircle, CreditCard, Info, Sparkles } from "lucide-react";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";
import { TableContainer } from "@/components/ui/table";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillingPlanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
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
      {!plan ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-semibold text-stone-950 mb-2">
            Тариф пока не подключён
          </h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            Реальная биллинговая интеграция ещё не настроена. Здесь появятся тариф, способ оплаты и история продлений после подключения провайдера.
          </p>
        </div>
      ) : (
        <>
          {/* Current Plan Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950 mb-6">
              Текущий тариф
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Left: Plan Info */}
              <div>
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EF8759] to-[#EF8759]/80 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-stone-950 mb-2">
                      {plan.name}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Активен</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Стоимость</p>
                    <p className="text-lg font-semibold text-stone-950">
                      {formatPrice(plan.price)} /{" "}
                      {plan.period === "month" ? "месяц" : "год"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Следующее списание</p>
                    <p className="text-lg font-semibold text-stone-950">
                      {plan.nextBillingDate ? formatDate(plan.nextBillingDate) : "Не запланировано"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Автопродление</p>
                    <p className="text-lg font-semibold text-stone-950">
                      {plan.autoRenewal ? "Включено" : "Выключено"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Payment Method + Actions */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs text-stone-500 mb-3">Способ оплаты</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border border-stone-200 bg-white flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-950">
                        {paymentMethod ? `${paymentMethod.brand} •••• ${paymentMethod.last4}` : "Не подключён"}
                      </p>
                      <p className="text-xs text-stone-500">
                        {paymentMethod ? `Истекает ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}` : "Способ оплаты не подключён"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button className="w-full px-4 py-2.5 bg-[#EF8759] text-white text-sm font-medium rounded-xl hover:bg-[#EF8759]/90 transition-colors">
                    Изменить тариф
                  </button>
                  <button className="w-full px-4 py-2.5 bg-white text-stone-700 text-sm font-medium border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
                    Обновить способ оплаты
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Features */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950 mb-4">
              Возможности тарифа
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {plan.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
                >
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600 mt-0.5" />
                  <span className="text-sm text-stone-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Renewal History */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h2 className="text-lg font-semibold text-stone-950">
                История продлений
              </h2>
            </div>
            <TableContainer minWidthClassName="min-w-[560px]" scrollLabel="История продлений, таблица">
              <table className="w-full">
                <thead className="bg-stone-50">
                  <tr className="border-b border-stone-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Операция
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Сумма
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {planHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-stone-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-stone-950">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-700">
                        {item.operation}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-stone-950">
                        {formatPrice(item.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <TransactionStatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">
                  Следующее автосписание: {plan.nextBillingDate ? formatDate(plan.nextBillingDate) : "не запланировано"}
                </p>
                <p className="text-blue-700">
                  Вы можете изменить тариф или отключить автопродление до даты продления.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
