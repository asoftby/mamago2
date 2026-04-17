import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getPlans } from "@/server/services/billing/billingPlans.service";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/formatters/format-price";

export default async function AdminBillingPlansPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const plans = await getPlans();

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Тарифы</h1>
          <p className="text-sm text-gray-600 mt-1">Управление коммерческими планами для бизнеса</p>
        </div>
        <button className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          Создать тариф
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Всего тарифов</p>
          <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 mb-1">Активных</p>
          <p className="text-2xl font-bold text-green-900">
            {plans.filter((p) => p.isActive).length}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-1">Видимых</p>
          <p className="text-2xl font-bold text-blue-900">
            {plans.filter((p) => p.isVisible).length}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700 mb-1">Подписок</p>
          <p className="text-2xl font-bold text-purple-900">
            {plans.reduce((sum: number, p) => sum + p._count.subscriptions, 0)}
          </p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-lg border-2 p-6 ${
              plan.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{plan.code}</p>
              </div>
              <div className="flex gap-2">
                {plan.isActive ? (
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    Активен
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    Неактивен
                  </span>
                )}
                {!plan.isVisible && (
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                    Скрыт
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(plan.price.toNumber())}
                </span>
                <span className="text-sm text-gray-500">
                  / {plan.interval === "MONTH" ? "мес" : "год"}
                </span>
              </div>
            </div>

            {/* Description */}
            {plan.description && (
              <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
            )}

            {/* Features */}
            <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Места</span>
                <span className="font-medium text-gray-900">
                  {plan.maxPlaces === 0 ? "∞" : plan.maxPlaces}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Предложения</span>
                <span className="font-medium text-gray-900">
                  {plan.maxOffers === 0 ? "∞" : plan.maxOffers}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">События</span>
                <span className="font-medium text-gray-900">
                  {plan.maxEvents === 0 ? "∞" : plan.maxEvents}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Сторис/мес</span>
                <span className="font-medium text-gray-900">
                  {plan.storiesPerMonth === 0 ? "∞" : plan.storiesPerMonth}
                </span>
              </div>
            </div>

            {/* Premium Features */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                {plan.hasPriorityBoost ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-gray-300" />
                )}
                <span className={plan.hasPriorityBoost ? "text-gray-900" : "text-gray-400"}>
                  Приоритетное продвижение
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {plan.hasLeadAccess ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-gray-300" />
                )}
                <span className={plan.hasLeadAccess ? "text-gray-900" : "text-gray-400"}>
                  Доступ к лидам
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {plan.hasAnalytics ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-gray-300" />
                )}
                <span className={plan.hasAnalytics ? "text-gray-900" : "text-gray-400"}>
                  Аналитика
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Активных подписок</span>
                <span className="text-lg font-bold text-gray-900">
                  {plan._count.subscriptions}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                Редактировать
              </button>
              <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
                {plan.isActive ? "Деактивировать" : "Активировать"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {plans.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">Тарифы не найдены</p>
          <button className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            Создать первый тариф
          </button>
        </div>
      )}
    </div>
  );
}
