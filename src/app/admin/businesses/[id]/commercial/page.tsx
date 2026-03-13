import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBusinessCommercialSummary } from "@/server/services/commercial/commercialOverview.service";
import { getBusinessContracts } from "@/server/services/commercial/contracts.service";
import { getBusinessPlacements } from "@/server/services/commercial/placements.service";
import { getBusinessServicePlacements } from "@/server/services/commercial/servicePlacements.service";
import { getBusinessNotifications } from "@/server/services/commercial/commercialNotifications.service";
import { ContractStatusBadge } from "@/components/admin/commercial/ContractStatusBadge";
import { PlacementStatusBadge } from "@/components/admin/commercial/PlacementStatusBadge";
import { FileText, MapPin, Star, AlertTriangle, Clock, Shield } from "lucide-react";
import { format, formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { prisma } from "@/lib/prisma";

export default async function AdminBusinessCommercialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id: businessId } = await params;
  
  // Get business info
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!business) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">Business not found</p>
      </div>
    );
  }

  const summary = await getBusinessCommercialSummary(businessId);
  const contracts = await getBusinessContracts(businessId);
  const placements = await getBusinessPlacements(businessId);
  const servicePlacements = await getBusinessServicePlacements(businessId);
  const notifications = await getBusinessNotifications(businessId);

  const activeContract = summary.contract;
  const activePlacement = summary.placement;
  const activeServices = summary.servicePlacements;

  // Calculate warnings
  const warnings: string[] = [];
  if (activeContract?.status === "EXPIRING") {
    const daysUntilEnd = Math.ceil(
      (activeContract.endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    warnings.push(`Договор истекает через ${daysUntilEnd} дн.`);
  }
  if (activeContract?.status === "EXPIRED") {
    warnings.push("Договор истек");
  }
  if (activePlacement?.status === "EXPIRING") {
    const daysUntilEnd = Math.ceil(
      (activePlacement.endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    warnings.push(`Размещение заканчивается через ${daysUntilEnd} дн.`);
  }
  if (activePlacement?.status === "EXPIRED") {
    warnings.push("Размещение завершено");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{business.name}</h1>
          <p className="text-gray-600 mt-1">Коммерческий контроль</p>
          <p className="text-sm text-gray-500">{business.owner.email}</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Действия
        </button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-900">
              {warnings.map((warning, idx) => (
                <p key={idx} className="font-medium">{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Договор</p>
          </div>
          {activeContract ? (
            <>
              <p className="text-lg font-bold text-gray-900 font-mono">
                {activeContract.contractNumber}
              </p>
              <div className="mt-2">
                <ContractStatusBadge status={activeContract.status} />
              </div>
            </>
          ) : (
            <p className="text-lg text-gray-400">Нет активного</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Действует до</p>
          </div>
          {activeContract ? (
            <>
              <p className="text-lg font-bold text-gray-900">
                {format(activeContract.endsAt, "dd MMM yyyy", { locale: ru })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {formatDistance(activeContract.endsAt, new Date(), {
                  addSuffix: true,
                  locale: ru,
                })}
              </p>
            </>
          ) : (
            <p className="text-lg text-gray-400">—</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Размещение</p>
          </div>
          {activePlacement ? (
            <>
              <p className="text-lg font-bold text-gray-900">
                {activePlacement.plan?.name || "Активно"}
              </p>
              <div className="mt-2">
                <PlacementStatusBadge status={activePlacement.status} />
              </div>
            </>
          ) : (
            <p className="text-lg text-gray-400">Нет активного</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Услуги</p>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {activeServices.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Активных</p>
        </div>
      </div>

      {/* Contracts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Договоры</h2>
        {contracts.length > 0 ? (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-gray-900 font-mono">
                      {contract.contractNumber}
                    </p>
                    <ContractStatusBadge status={contract.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(contract.startsAt, "dd MMM yyyy", { locale: ru })} — {format(contract.endsAt, "dd MMM yyyy", { locale: ru })}
                  </p>
                </div>
                {contract.documentUrl && (
                  <a
                    href={contract.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Документ →
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Договоры не найдены</p>
        )}
      </div>

      {/* Placement Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Размещение</h2>
        {placements.length > 0 ? (
          <div className="space-y-3">
            {placements.map((placement) => (
              <div
                key={placement.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {placement.plan && (
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <p className="font-medium text-gray-900">{placement.plan.name}</p>
                      </div>
                    )}
                    <PlacementStatusBadge status={placement.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(placement.startsAt, "dd MMM yyyy", { locale: ru })} — {format(placement.endsAt, "dd MMM yyyy", { locale: ru })}
                  </p>
                  {placement.graceUntil && placement.graceUntil > new Date() && (
                    <p className="text-sm text-blue-600 mt-1">
                      Grace период до {format(placement.graceUntil, "dd MMM yyyy", { locale: ru })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Размещения не найдены</p>
        )}
      </div>

      {/* Service Placements Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Коммерческие услуги</h2>
        {servicePlacements.length > 0 ? (
          <div className="space-y-3">
            {servicePlacements.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-gray-900">{service.entityType}</p>
                    <PlacementStatusBadge status={service.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{service.notes}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    До {format(service.endsAt, "dd MMM yyyy", { locale: ru })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Услуги не найдены</p>
        )}
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Уведомления</h2>
        {notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistance(notification.scheduledFor, new Date(), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
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
        ) : (
          <p className="text-gray-500 text-center py-8">Уведомления не найдены</p>
        )}
      </div>

      {/* Access Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Текущий статус доступа</h3>
        <div className="space-y-2 text-sm text-blue-800">
          {activeContract?.status === "ACTIVE" && (
            <p>✓ Договор активен до {format(activeContract.endsAt, "dd MMMM yyyy", { locale: ru })}</p>
          )}
          {activeContract?.status === "EXPIRED" && (
            <p>✗ Договор истек {format(activeContract.endsAt, "dd MMMM yyyy", { locale: ru })}</p>
          )}
          {activePlacement?.status === "ACTIVE" && (
            <p>✓ Размещение активно до {format(activePlacement.endsAt, "dd MMMM yyyy", { locale: ru })}</p>
          )}
          {activePlacement?.status === "EXPIRED" && (
            <p>✗ Размещение завершено</p>
          )}
          {activeServices.length > 0 && (
            <p>✓ Активных услуг: {activeServices.length}</p>
          )}
          {!activeContract && !activePlacement && (
            <p>⚠ Нет активных договоров и размещений</p>
          )}
        </div>
      </div>
    </div>
  );
}
