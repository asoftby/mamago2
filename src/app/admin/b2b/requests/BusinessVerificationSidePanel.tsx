"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { BusinessVisibilityControl } from "@/components/admin/business/BusinessVisibilityControl";
import { normalizeBusinessVisibilityStatus } from "@/lib/business/businessStatusModel";
import { BusinessDangerZonePlaceholder } from "@/components/admin/business/BusinessDangerZonePlaceholder";

type BusinessDetail = {
  id: string;
  name: string;
  legalName: string | null;
  unp: string | null;
  phone: string | null;
  operationalStatus: "ACTIVE" | "DISABLED" | "ARCHIVED";
  verificationStatus: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    phoneE164: string | null;
    createdAt: string;
  };
  verificationLogs: Array<{
    id: string;
    statusFrom: string;
    statusTo: string;
    note: string | null;
    createdAt: string;
    reviewedBy: {
      email: string;
    } | null;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  NEEDS_INFO: "Требуется уточнение",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
};

export function BusinessVerificationSidePanel({
  businessId,
  onClose,
  onActionComplete,
}: {
  businessId: string;
  onClose: () => void;
  onActionComplete: (newStatus: string) => void;
}) {
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [canManageBusinessVisibility, setCanManageBusinessVisibility] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, [businessId]);

  const fetchBusiness = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/business-verification/${businessId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки");
      }

      setBusiness(data.business);
      setCanManageBusinessVisibility(data.canManageBusinessVisibility === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Одобрить этот бизнес?")) {
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/admin/business-verification/${businessId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note || undefined }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка одобрения");
      }

      alert("Бизнес одобрен");
      onActionComplete("APPROVED");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка одобрения");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNeedsInfo = async () => {
    if (!note || note.trim().length === 0) {
      alert("Укажите, какие данные требуется уточнить");
      return;
    }

    if (!confirm("Запросить уточнение данных?")) {
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/admin/business-verification/${businessId}/needs-info`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка запроса");
      }

      alert("Запрошено уточнение данных");
      onActionComplete("NEEDS_INFO");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!note || note.trim().length === 0) {
      alert("Укажите причину отклонения");
      return;
    }

    if (!confirm("Отклонить этот бизнес?")) {
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/admin/business-verification/${businessId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка отклонения");
      }

      alert("Бизнес отклонен");
      onActionComplete("REJECTED");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка отклонения");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Детали заявки</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">Загрузка...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && !business && (
            <div className="text-center py-8">Бизнес не найден</div>
          )}

          {!loading && !error && business && (
            <div className="space-y-6">
              {/* Business Name & Status */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{business.name}</h3>
                <p className="text-gray-600 mt-1">
                  Статус верификации:{" "}
                  {STATUS_LABELS[business.verificationStatus]}
                </p>
              </div>

              {/* Business Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3">Информация о бизнесе</h4>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Юридическое название
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.legalName || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">УНП</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.unp || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Телефон</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.phone || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Дата создания
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(business.createdAt).toLocaleString("ru-RU")}
                    </dd>
                  </div>
                  {business.submittedAt && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Дата подачи
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(business.submittedAt).toLocaleString("ru-RU")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Owner Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3">Владелец</h4>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.owner.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Телефон</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.owner.phoneE164 || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Дата регистрации
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(business.owner.createdAt).toLocaleString("ru-RU")}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Review Note */}
              {business.reviewNote && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-2">Примечание модератора</h4>
                  <p className="text-gray-800 text-sm">{business.reviewNote}</p>
                </div>
              )}

              {/* Verification Logs */}
              {business.verificationLogs.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">История проверки</h4>
                  <div className="space-y-3">
                    {business.verificationLogs.map((log) => (
                      <div key={log.id} className="border-l-4 border-gray-300 pl-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {STATUS_LABELS[log.statusFrom]} →{" "}
                            {STATUS_LABELS[log.statusTo]}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(log.createdAt).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-sm text-gray-700 mt-1">{log.note}</p>
                        )}
                        {log.reviewedBy && (
                          <p className="text-xs text-gray-500 mt-1">
                            Модератор: {log.reviewedBy.email}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Panel */}
              {business.verificationStatus === "PENDING" && (
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">Модерация</h4>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="note"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Комментарий модератора
                        <span className="text-gray-500 text-xs ml-2">
                          (обязателен для уточнения и отклонения)
                        </span>
                      </label>
                      <textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="Укажите причину отклонения или что требуется уточнить..."
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleNeedsInfo}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading ? "Обработка..." : "Уточнить данные"}
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading ? "Обработка..." : "Одобрить"}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading ? "Обработка..." : "Отклонить"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 border-t border-gray-100 pt-4">
                <BusinessVisibilityControl
                  businessId={business.id}
                  readOnly={!canManageBusinessVisibility}
                  initialVisibilityStatus={normalizeBusinessVisibilityStatus(
                    business.operationalStatus,
                  )}
                  onStatusChange={(next) => {
                    setBusiness((prev) =>
                      prev ? { ...prev, operationalStatus: next } : prev,
                    );
                  }}
                />
                <BusinessDangerZonePlaceholder />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
