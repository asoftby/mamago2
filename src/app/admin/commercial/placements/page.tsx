import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getPlacements } from "@/server/services/commercial/placements.service";
import { PlacementStatusBadge } from "@/components/admin/commercial/PlacementStatusBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MapPin, Shield } from "lucide-react";
import { CommercialToolbarFilterSelects } from "@/components/admin/commercial/CommercialToolbarFilterSelects";

export default async function AdminPlacementsPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let placements: unknown[] = [];
  let error: string | null = null;

  try {
    placements = await getPlacements();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : "Unknown error";
    console.error("Placements fetch error:", e);
  }

  if (error) {
    return (
      <div className="p-6 md:p-4 space-y-6">
        {/* AdminPageHeader */}
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Размещения</h1>
          <p className="text-sm text-gray-600 mt-1">Коммерческий доступ бизнесов к платформе</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">Ошибка загрузки данных. Выполните: <code className="bg-red-100 px-2 py-1 rounded text-xs">npx prisma generate && npm run dev</code></p>
          <p className="text-xs text-red-700 mt-2">Error: {error}</p>
        </div>
      </div>
    );
  }

  const sourceTypeLabels = {
    SUBSCRIPTION: "Подписка",
    MANUAL: "Вручную",
    PROMO_PACKAGE: "Промо-пакет",
    BONUS: "Бонус",
  };

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Размещения</h1>
          <p className="text-sm text-gray-600 mt-1">Коммерческий доступ бизнесов к платформе</p>
        </div>
        <button className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Создать размещение
        </button>
      </div>

      {/* AdminPageToolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <CommercialToolbarFilterSelects
          filters={[
            {
              placeholder: "Все статусы",
              options: [
                { value: "ACTIVE", label: "Активные" },
                { value: "EXPIRING", label: "Заканчиваются" },
                { value: "EXPIRED", label: "Завершенные" },
                { value: "PAUSED", label: "Приостановленные" },
                { value: "CANCELED", label: "Отмененные" },
              ],
            },
            {
              placeholder: "Все источники",
              options: [
                { value: "SUBSCRIPTION", label: "Подписка" },
                { value: "MANUAL", label: "Вручную" },
                { value: "PROMO_PACKAGE", label: "Промо-пакет" },
                { value: "BONUS", label: "Бонус" },
              ],
            },
          ]}
        />
        <button className="h-10 w-full md:w-auto px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Заканчиваются на этой неделе
        </button>
      </div>

      {/* AdminPageContent */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Бизнес</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Источник</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">План</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Начало</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Окончание</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Grace период</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(placements as { endsAt: Date; graceUntil: Date | null; [key: string]: unknown }[]).map((placement) => {
                const daysUntilEnd = Math.ceil(
                  (placement.endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isExpiringSoon = daysUntilEnd <= 7 && daysUntilEnd > 0;
                const hasGracePeriod = placement.graceUntil && placement.graceUntil > new Date();

                return (
                  <tr
                    key={placement.id}
                    className={`hover:bg-gray-50 ${
                      isExpiringSoon ? "bg-orange-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/businesses/${placement.businessId}/commercial`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {placement.business.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {sourceTypeLabels[placement.sourceType as keyof typeof sourceTypeLabels]}
                    </td>
                    <td className="py-3 px-4">
                      {placement.plan ? (
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-900">{placement.plan.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <PlacementStatusBadge status={placement.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {format(placement.startsAt, "dd MMM yyyy", { locale: ru })}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-gray-900">
                          {format(placement.endsAt, "dd MMM yyyy", { locale: ru })}
                        </p>
                        {isExpiringSoon && (
                          <p className="text-xs text-orange-600 font-medium mt-0.5">
                            Через {daysUntilEnd} дн.
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {hasGracePeriod ? (
                        <div>
                          <p className="text-gray-900">
                            {format(placement.graceUntil!, "dd MMM yyyy", { locale: ru })}
                          </p>
                          <p className="text-xs text-blue-600 font-medium mt-0.5">
                            Grace период
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-blue-600 hover:text-blue-700">
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {placements.length === 0 && (
        <div className="border border-gray-200 rounded-lg p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Размещения не найдены</p>
        </div>
      )}
    </div>
  );
}
