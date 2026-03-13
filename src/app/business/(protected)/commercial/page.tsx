"use client";

import { useEffect, useState } from "react";
import { FileText, MapPin, Star, AlertTriangle, ExternalLink, Clock, Shield } from "lucide-react";
import { format, formatDistance } from "date-fns";
import { ru } from "date-fns/locale";

interface CommercialSummary {
  contract: any;
  placement: any;
  servicePlacements: any[];
  notifications: any[];
}

export default function BusinessCommercialPage() {
  const [summary, setSummary] = useState<CommercialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch from API
    // For now, show placeholder
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Mock data for demonstration
  const mockContract = {
    contractNumber: "DOG-2024-0001",
    status: "EXPIRING",
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    documentUrl: "/documents/contracts/DOG-2024-0001.pdf",
  };

  const mockPlacement = {
    status: "ACTIVE",
    plan: { name: "Business Pro" },
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    graceUntil: null,
  };

  const mockServices = [
    {
      id: "1",
      entityType: "PROMO",
      notes: "Промо-размещение на главной странице",
      endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  ];

  const mockNotifications = [
    {
      id: "1",
      title: "Договор истекает",
      message: "Ваш договор DOG-2024-0001 истекает через 7 дней. Пожалуйста, свяжитесь с нами для продления.",
      scheduledFor: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: "SENT",
    },
  ];

  const daysUntilContractEnd = Math.ceil(
    (mockContract.endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Коммерческий статус</h1>
        <p className="text-gray-600 mt-2">
          Договоры, размещение и коммерческие услуги
        </p>
      </div>

      {/* Alerts */}
      {mockContract.status === "EXPIRING" && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-900">
                Договор истекает через {daysUntilContractEnd} дней
              </p>
              <p className="text-sm text-orange-800 mt-1">
                Пожалуйста, свяжитесь с нами для продления договора. После истечения срока доступ к коммерческим функциям будет ограничен.
              </p>
              <button className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                Связаться с менеджером
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Договор</h2>
              <p className="text-sm text-gray-600">Коммерческое соглашение</p>
            </div>
          </div>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
              mockContract.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : mockContract.status === "EXPIRING"
                ? "bg-orange-100 text-orange-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {mockContract.status === "ACTIVE"
              ? "Активен"
              : mockContract.status === "EXPIRING"
              ? "Истекает"
              : "Истек"}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Номер договора</p>
            <p className="font-mono text-gray-900 font-medium">{mockContract.contractNumber}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Действует до</p>
            <p className="text-gray-900 font-medium">
              {format(mockContract.endsAt, "dd MMMM yyyy", { locale: ru })}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDistance(mockContract.endsAt, new Date(), {
                addSuffix: true,
                locale: ru,
              })}
            </p>
          </div>
        </div>

        {mockContract.documentUrl && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <a
              href={mockContract.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Скачать договор (PDF)
            </a>
          </div>
        )}
      </div>

      {/* Placement Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Размещение</h2>
              <p className="text-sm text-gray-600">Коммерческий доступ к платформе</p>
            </div>
          </div>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
              mockPlacement.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : mockPlacement.status === "EXPIRING"
                ? "bg-orange-100 text-orange-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {mockPlacement.status === "ACTIVE"
              ? "Активно"
              : mockPlacement.status === "EXPIRING"
              ? "Заканчивается"
              : "Завершено"}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Текущий план</p>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <p className="text-gray-900 font-medium">{mockPlacement.plan.name}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Активно до</p>
            <p className="text-gray-900 font-medium">
              {format(mockPlacement.endsAt, "dd MMMM yyyy", { locale: ru })}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDistance(mockPlacement.endsAt, new Date(), {
                addSuffix: true,
                locale: ru,
              })}
            </p>
          </div>
        </div>

        {mockPlacement.graceUntil && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-blue-600">
              <Clock className="w-4 h-4" />
              <p className="text-sm font-medium">
                Grace период до {format(mockPlacement.graceUntil, "dd MMMM yyyy", { locale: ru })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active Services */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Star className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Активные услуги</h2>
            <p className="text-sm text-gray-600">Временные коммерческие функции</p>
          </div>
        </div>

        {mockServices.length > 0 ? (
          <div className="space-y-3">
            {mockServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{service.notes}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Активно до {format(service.endsAt, "dd MMMM yyyy", { locale: ru })}
                  </p>
                </div>
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Активно
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Нет активных услуг</p>
        )}
      </div>

      {/* Notifications */}
      {mockNotifications.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Уведомления</h2>
          <div className="space-y-3">
            {mockNotifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg"
              >
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatDistance(notification.scheduledFor, new Date(), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consequences Block */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Что происходит после истечения срока?</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Договор истек:</strong> Бизнес может оставаться видимым, но коммерческие функции будут отключены.
          </p>
          <p>
            <strong>Размещение завершено:</strong> Премиум-функции (продвижение, аналитика, приоритетное размещение) будут недоступны.
          </p>
          <p>
            <strong>Услуга завершена:</strong> Конкретная услуга (промо, сторис, продвижение) перестанет действовать.
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm text-blue-800">
            Для продления или изменения условий свяжитесь с вашим менеджером или напишите на{" "}
            <a href="mailto:commercial@mamago.by" className="font-medium underline">
              commercial@mamago.by
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
