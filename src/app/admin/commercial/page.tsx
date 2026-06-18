import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getAdminCommercialOverview } from "@/server/services/commercial/commercialOverview.service";
import {
  FileText,
  MapPin,
  Star,
  AlertTriangle,
  Clock,
  XCircle,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { CommercialKpiCard } from "@/components/admin/commercial/CommercialKpiCard";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminCommercialPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let overview: Awaited<ReturnType<typeof getAdminCommercialOverview>> | null = null;
  let error: string | null = null;

  try {
    overview = await getAdminCommercialOverview();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
    console.error("Commercial overview error:", e);
  }

  if (error || !overview) {
    return (
      <div className="p-6">
        <AdminPageHeader
          title="Коммерческий контроль"
          subtitle="Договоры, размещение и сроки действия коммерческих услуг"
        />
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Ошибка загрузки данных</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const expiringContracts = overview.contracts.expiring;
  const expiredContracts = overview.contracts.expired;

  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Коммерческий контроль"
        subtitle="Договоры, размещение и сроки действия коммерческих услуг"
      />

      {/* Alert strips — render only when count > 0 */}
      {expiringContracts > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>
            <strong>{expiringContracts}</strong>{" "}
            {expiringContracts === 1
              ? "договор истекает"
              : expiringContracts < 5
              ? "договора истекают"
              : "договоров истекают"}{" "}
            в течение 30 дней
          </span>
          <Link
            href="/admin/commercial/contracts?status=EXPIRING"
            className="ml-auto flex items-center gap-1 font-medium hover:underline whitespace-nowrap"
          >
            Просмотреть <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {expiredContracts > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>
            <strong>{expiredContracts}</strong>{" "}
            {expiredContracts === 1
              ? "договор истёк"
              : expiredContracts < 5
              ? "договора истекли"
              : "договоров истекли"}
            . Размещения деактивированы.
          </span>
          <Link
            href="/admin/commercial/contracts?status=EXPIRED"
            className="ml-auto flex items-center gap-1 font-medium hover:underline whitespace-nowrap"
          >
            Просмотреть <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* KPI grid 3×2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <CommercialKpiCard
          icon={FileText}
          label="Активные договоры"
          value={overview.contracts.active}
          context={
            overview.contracts.newThisMonth > 0
              ? `+${overview.contracts.newThisMonth} за этот месяц`
              : "Без изменений в этом месяце"
          }
          accent={overview.contracts.newThisMonth > 0 ? "green" : "default"}
        />
        <CommercialKpiCard
          icon={Clock}
          label="Истекающие договоры"
          value={expiringContracts}
          context="≤ 30 дней до окончания"
          accent={expiringContracts > 0 ? "yellow" : "default"}
        />
        <CommercialKpiCard
          icon={XCircle}
          label="Истекшие договоры"
          value={expiredContracts}
          context="Требуют продления"
          accent={expiredContracts > 0 ? "red" : "default"}
        />
        <CommercialKpiCard
          icon={MapPin}
          label="Активные размещения"
          value={overview.placements.active}
          context="Мест на платформе"
          accent="default"
        />
        <CommercialKpiCard
          icon={AlertTriangle}
          label="Заканчиваются на неделе"
          value={overview.placements.expiring}
          context="Размещений истекает ≤ 7 дней"
          accent={overview.placements.expiring > 0 ? "yellow" : "default"}
        />
        <CommercialKpiCard
          icon={Star}
          label="Активные услуги"
          value={overview.servicePlacements.active}
          context="Коммерческих услуг"
          accent="default"
        />
      </div>

      {/* Section cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Contracts */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Договоры</p>
              <p className="text-xs text-gray-500 mt-0.5">Коммерческие договоры бизнесов</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Активные</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {overview.contracts.active}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Истекающие</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {expiringContracts}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Истекшие</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {expiredContracts}
              </span>
            </div>
          </div>
          <Link
            href="/admin/commercial/contracts"
            className="mt-auto flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Управление договорами
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Placements */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Размещения</p>
              <p className="text-xs text-gray-500 mt-0.5">Коммерческий доступ бизнесов</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Активные</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {overview.placements.active}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Истекающие</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {overview.placements.expiring}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Истекшие</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {overview.placements.expired}
              </span>
            </div>
          </div>
          <Link
            href="/admin/commercial/placements"
            className="mt-auto flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Управление размещениями
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Services */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Star className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Услуги</p>
              <p className="text-xs text-gray-500 mt-0.5">Временные коммерческие услуги</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Активные</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {overview.servicePlacements.active}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Истекающие</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {overview.servicePlacements.expiring}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Истекшие</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {overview.servicePlacements.expired}
              </span>
            </div>
          </div>
          <Link
            href="/admin/commercial/service-placements"
            className="mt-auto flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Управление услугами
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Businesses needing attention */}
      {overview.businessesNeedingAttention.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-orange-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              Требуют внимания ({overview.businessesNeedingAttention.length})
            </h2>
          </div>
          <div className="space-y-2">
            {overview.businessesNeedingAttention.slice(0, 10).map((business) => (
              <Link
                key={business.id}
                href={`/admin/businesses/${business.id}/commercial`}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{business.name}</p>
                <div className="flex flex-wrap gap-1.5 ml-4">
                  {business.issues.map((issue, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700"
                    >
                      {issue}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
