import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { 
  mockCurrentPlan, 
  mockPaymentMethod, 
  mockPlanHistory,
  formatCurrency,
  formatDate,
} from "@/lib/mocks/businessBilling";
import { CheckCircle, CreditCard, Calendar, Info } from "lucide-react";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";

export default async function BillingPlanPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const plan = mockCurrentPlan;
  const paymentMethod = mockPaymentMethod;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Тариф и подписка</h1>
        <p className="text-gray-600 mt-2">
          Управление текущим планом бизнеса
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Текущий тариф</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Активен</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Стоимость</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(plan.price, plan.currency)} / {plan.period === "month" ? "месяц" : "год"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Следующее списание</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(plan.nextBillingDate)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Автопродление</p>
                <p className="text-lg font-semibold text-gray-900">
                  {plan.autoRenewal ? "Включено" : "Выключено"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">Способ оплаты</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white flex items-center justify-center border border-gray-200">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {paymentMethod.brand} •••• {paymentMethod.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    Истекает {paymentMethod.expiryMonth}/{paymentMethod.expiryYear}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                Изменить тариф
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                Обновить способ оплаты
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Included Features */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Возможности тарифа</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">История продлений</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Дата</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Операция</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Сумма</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Статус</th>
              </tr>
            </thead>
            <tbody>
              {mockPlanHistory.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{formatDate(item.date)}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{item.operation}</td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                    {formatCurrency(item.amount, "BYN")}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <TransactionStatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Block */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Следующее автосписание произойдет {formatDate(plan.nextBillingDate)}</p>
            <p className="text-blue-700">Вы можете изменить тариф или отключить автопродление до даты продления.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
