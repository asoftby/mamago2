"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BusinessDetail = {
  id: string;
  name: string;
  legalName: string | null;
  unp: string | null;
  phone: string | null;
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
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
};

export function BusinessVerificationDetail({
  businessId,
}: {
  businessId: string;
}) {
  const router = useRouter();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
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
      router.push("/admin/business/verification?status=APPROVED");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка одобрения");
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
      router.push("/admin/business/verification?status=REJECTED");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка отклонения");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (!business) {
    return <div className="text-center py-8">Бизнес не найден</div>;
  }

  const canModerate = business.verificationStatus === "PENDING";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/business/verification?status=PENDING"
          className="text-primary hover:underline mb-2 inline-block"
        >
          ← Назад к списку
        </Link>
        <h1 className="text-3xl font-bold">{business.name}</h1>
        <p className="text-gray-600 mt-1">
          Статус: {STATUS_LABELS[business.verificationStatus]}
        </p>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Информация о бизнесе</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Владелец</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">Примечание модератора</h2>
          <p className="text-gray-800">{business.reviewNote}</p>
        </div>
      )}

      {/* Verification Logs */}
      {business.verificationLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">История проверки</h2>
          <div className="space-y-4">
            {business.verificationLogs.map((log) => (
              <div key={log.id} className="border-l-4 border-gray-300 pl-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {STATUS_LABELS[log.statusFrom]} →{" "}
                    {STATUS_LABELS[log.statusTo]}
                  </span>
                  <span className="text-gray-500">
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
      {canModerate && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Модерация</h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="note"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Примечание (необязательно для одобрения, обязательно для
                отклонения)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Укажите причину отклонения или комментарий..."
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Обработка..." : "Одобрить"}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Обработка..." : "Отклонить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
