import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getServicePlacements } from "@/server/services/commercial/servicePlacements.service";
import { PlacementStatusBadge } from "@/components/admin/commercial/PlacementStatusBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Star, MapPin, Calendar, Gift, Megaphone, BookOpen } from "lucide-react";

export default async function AdminServicePlacementsPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let servicePlacements: Awaited<ReturnType<typeof getServicePlacements>> = [];
  let error: string | null = null;

  try {
    servicePlacements = await getServicePlacements();
  } catch (e: any) {
    error = e.message;
    console.error("Service placements fetch error:", e);
  }

  if (error) {
    return (
      <div className="p-6 md:p-4 space-y-6">
        {/* AdminPageHeader */}
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Коммерческие услуги</h1>
          <p className="text-sm text-gray-600 mt-1">Временные коммерческие услуги для конкретных сущностей</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">Ошибка загрузки данных. Выполните: <code className="bg-red-100 px-2 py-1 rounded text-xs">npx prisma generate && npm run dev</code></p>
          <p className="text-xs text-red-700 mt-2">Error: {error}</p>
        </div>
      </div>
    );
  }

  const entityTypeLabels = {
    PLACE: "Место",
    EVENT: "Мероприятие",
    OFFER: "Предложение",
    STORY: "История",
    PROMO: "Промо",
  };

  const entityTypeIcons = {
    PLACE: MapPin,
    EVENT: Calendar,
    OFFER: Gift,
    STORY: BookOpen,
    PROMO: Megaphone,
  };

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Коммерческие услуги</h1>
          <p className="text-sm text-gray-600 mt-1">Временные коммерческие услуги для конкретных сущностей</p>
        </div>
        <button className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Создать услугу
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Важно:</strong> Коммерческие услуги — это временные функции для конкретных сущностей 
          (промо-размещение, пакет сторис, продвижение мероприятия). Они отличаются от общего размещения бизнеса.
        </p>
      </div>

      {/* AdminPageToolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <select className="h-10 w-full md:w-auto px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">Все статусы</option>
          <option value="ACTIVE">Активные</option>
          <option value="EXPIRING">Заканчиваются</option>
          <option value="EXPIRED">Завершенные</option>
          <option value="CANCELED">Отмененные</option>
        </select>
        <select className="h-10 w-full md:w-auto px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">Все типы</option>
          <option value="PLACE">Место</option>
          <option value="EVENT">Мероприятие</option>
          <option value="OFFER">Предложение</option>
          <option value="STORY">История</option>
          <option value="PROMO">Промо</option>
        </select>
        <button className="h-10 w-full md:w-auto px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Заканчиваются в течение 7 дней
        </button>
      </div>

      {/* AdminPageContent */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Бизнес</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Тип услуги</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Описание</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Начало</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Окончание</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {servicePlacements.map((service) => {
                const daysUntilEnd = Math.ceil(
                  (service.endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isExpiringSoon = daysUntilEnd <= 3 && daysUntilEnd > 0;
                const Icon = entityTypeIcons[service.entityType];

                return (
                  <tr
                    key={service.id}
                    className={`hover:bg-gray-50 ${
                      isExpiringSoon ? "bg-orange-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/businesses/${service.businessId}/commercial`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {service.business.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-purple-600" />
                        <span className="text-gray-900">
                          {entityTypeLabels[service.entityType]}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {service.notes || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <PlacementStatusBadge status={service.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {format(service.startsAt, "dd MMM yyyy", { locale: ru })}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-gray-900">
                          {format(service.endsAt, "dd MMM yyyy", { locale: ru })}
                        </p>
                        {isExpiringSoon && (
                          <p className="text-xs text-orange-600 font-medium mt-0.5">
                            Через {daysUntilEnd} дн.
                          </p>
                        )}
                      </div>
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

      {servicePlacements.length === 0 && (
        <div className="border border-gray-200 rounded-lg p-12 text-center">
          <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Коммерческие услуги не найдены</p>
        </div>
      )}
    </div>
  );
}
