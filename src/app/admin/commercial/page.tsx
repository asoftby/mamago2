import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getAdminCommercialOverview, getBusinessesNeedingAttention } from "@/server/services/commercial/commercialOverview.service";
import { getNotifications } from "@/server/services/commercial/commercialNotifications.service";
import { FileText, MapPin, Star, AlertTriangle, Clock, XCircle } from "lucide-react";
import { CommercialKpiCard } from "@/components/admin/commercial/CommercialKpiCard";
import { ContractStatusBadge } from "@/components/admin/commercial/ContractStatusBadge";
import { PlacementStatusBadge } from "@/components/admin/commercial/PlacementStatusBadge";
import Link from "next/link";
import { formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminCommercialPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let overview;
  let businessesNeedingAttention;
  let recentNotifications;
  let error = null;

  try {
    overview = await getAdminCommercialOverview();
    businessesNeedingAttention = await getBusinessesNeedingAttention();
    recentNotifications = await getNotifications({
      scheduledBefore: new Date(),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    console.error("Commercial overview error:", e);
  }

  // Show error state if Prisma client not generated or data missing
  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Коммерческий контроль</h1>
          <p className="text-gray-600 mt-1">Договоры, размещение и сроки действия коммерческих услуг</p>
        </div>

        <div className="space-y-6">

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Ошибка загрузки данных
              </h3>
              <p className="text-sm text-red-800 mb-4">
                Возможно, Prisma client не сгенерирован после добавления commercial моделей.
              </p>
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Выполните команды:</p>
                <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm font-mono mb-2">
                  npx prisma generate
                </code>
                <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
                  npm run dev
                </code>
              </div>
              <p className="text-xs text-red-700">
                Error: {error}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Инструкции по настройке</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Остановите dev server (Ctrl+C)</li>
            <li>Запустите: <code className="bg-blue-100 px-2 py-1 rounded">npx prisma generate</code></li>
            <li>Запустите: <code className="bg-blue-100 px-2 py-1 rounded">npx tsx prisma/seed-commercial.ts</code> (для тестовых данных)</li>
            <li>Запустите dev server: <code className="bg-blue-100 px-2 py-1 rounded">npm run dev</code></li>
          </ol>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Коммерческий контроль"
        subtitle="Договоры, размещение и сроки действия коммерческих услуг"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <CommercialKpiCard
          icon={FileText}
          label="Активные договоры"
          value={overview?.contracts?.active || 0}
        />
        <CommercialKpiCard
          icon={Clock}
          label="Истекающие договоры"
          value={overview?.contracts?.expiring || 0}
          alert={(overview?.contracts?.expiring || 0) > 0}
        />
        <CommercialKpiCard
          icon={XCircle}
          label="Истекшие договоры"
          value={overview?.contracts?.expired || 0}
          alert={(overview?.contracts?.expired || 0) > 0}
        />
        <CommercialKpiCard
          icon={MapPin}
          label="Активные размещения"
          value={overview?.placements?.active || 0}
        />
        <CommercialKpiCard
          icon={AlertTriangle}
          label="Заканчиваются на неделе"
          value={overview?.placements?.expiring || 0}
          alert={(overview?.placements?.expiring || 0) > 0}
        />
        <CommercialKpiCard
          icon={Star}
          label="Активные услуги"
          value={overview?.servicePlacements?.active || 0}
        />
      </div>

      {/* Businesses Needing Attention */}
      {businessesNeedingAttention && businessesNeedingAttention.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg md:text-base font-semibold text-gray-900">
              Требуют внимания ({businessesNeedingAttention.length})
            </h2>
          </div>
          <div className="space-y-3">
            {businessesNeedingAttention.slice(0, 10).map((business) => (
              <Link
                key={business.id}
                href={`/admin/businesses/${business.id}/commercial`}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{business.name}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {business.issues.map((issue, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700"
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {business.contract && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Договор</p>
                      <ContractStatusBadge status={business.contract.status} />
                    </div>
                  )}
                  {business.placement && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Размещение</p>
                      <PlacementStatusBadge status={business.placement.status} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {recentNotifications && recentNotifications.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">
            Последние уведомления
          </h2>
          <div className="space-y-2">
            {recentNotifications.slice(0, 10).map((notification) => (
            <div
              key={notification.id}
              className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    href={`/admin/businesses/${notification.businessId}/commercial`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {notification.business.name}
                  </Link>
                  <span className="text-xs text-gray-500">
                    {formatDistance(notification.scheduledFor, new Date(), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </span>
                </div>
              </div>
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  notification.status === "SENT"
                    ? "bg-blue-100 text-blue-700"
                    : notification.status === "READ"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {notification.status === "SENT"
                  ? "Отправлено"
                  : notification.status === "READ"
                  ? "Прочитано"
                  : "Ожидает"}
              </span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link
          href="/admin/commercial/contracts"
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Договоры</h3>
          </div>
          <p className="text-xs text-gray-600">Управление коммерческими договорами</p>
        </Link>
        <Link
          href="/admin/commercial/placements"
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Размещения</h3>
          </div>
          <p className="text-xs text-gray-600">Коммерческий доступ бизнесов</p>
        </Link>
        <Link
          href="/admin/commercial/service-placements"
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">Услуги</h3>
          </div>
          <p className="text-xs text-gray-600">Временные коммерческие услуги</p>
        </Link>
      </div>
    </div>
  );
}
