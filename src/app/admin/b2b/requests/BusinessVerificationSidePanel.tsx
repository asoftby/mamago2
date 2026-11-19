"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { adminPath } from "@/lib/routing/surface";
import { X } from "lucide-react";
import { BusinessVisibilityControl } from "@/components/admin/business/BusinessVisibilityControl";
import { normalizeBusinessVisibilityStatus } from "@/lib/business/businessStatusModel";
import { BusinessDangerZonePlaceholder } from "@/components/admin/business/BusinessDangerZonePlaceholder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatAdminDateTime } from "@/lib/admin/formatRu";

type BusinessDetail = {
  id: string;
  name: string;
  subjectType: string;
  registrationFullName: string | null;
  npdCheckStatus: string;
  npdCheckedAt: string | null;
  npdCheckedByUserId: string | null;
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

type AccessRequestSummary = {
  id: string;
  status: string;
  name: string;
  requesterRole: string;
  createdAt: string;
  requesterUser: { email: string };
};

const ACCESS_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "На проверке",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  NEEDS_INFO: "Нужны данные",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  NEEDS_INFO: "Требуется уточнение",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
};

const NPD_STATUS_LABELS: Record<string, string> = {
  REVIEW_REQUIRED: "Ожидает проверки",
  CONFIRMED: "Регистрация подтверждена",
  NOT_FOUND: "Регистрация не найдена",
  UNAVAILABLE: "Не удалось проверить",
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
  const [accessRequests, setAccessRequests] = useState<AccessRequestSummary[]>([]);
  const [canReviewAccessRequests, setCanReviewAccessRequests] = useState(false);
  const [canManageBusinessVisibility, setCanManageBusinessVisibility] =
    useState(false);
  const [canRecordNpdCheck, setCanRecordNpdCheck] = useState(false);
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
    setAccessRequests([]);
    setCanReviewAccessRequests(false);

    try {
      const res = await fetch(`/api/admin/business-verification/${businessId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки");
      }

      setBusiness(data.business);
      setAccessRequests(data.accessRequests ?? []);
      setCanReviewAccessRequests(data.canReviewAccessRequests === true);
      setCanRecordNpdCheck(data.canRecordNpdCheck === true);
      setCanManageBusinessVisibility(data.canManageBusinessVisibility === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const recordNpd = async (result: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/business-verification/${businessId}/npd-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result }) });
      if (!response.ok) throw new Error("Не удалось сохранить проверку. Требуются права администратора и заявка на проверке.");
      await fetchBusiness();
    } catch (error) { setError(error instanceof Error ? error.message : "Ошибка проверки"); }
    finally { setActionLoading(false); }
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
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-dvh w-full flex-col gap-0 border-l bg-white p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">Детали заявки</SheetTitle>

        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-bold">Детали заявки</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
                      {business.subjectType === "SELF_EMPLOYED_NPD" ? "ФИО" : "Юридическое название"}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.registrationFullName || business.legalName || "—"}
                      {business.subjectType === "SELF_EMPLOYED_NPD" && <div className="space-y-3">
                        <p>Проверка НПД: {NPD_STATUS_LABELS[business.npdCheckStatus] ?? "Статус уточняется"}</p>
                        <p>Дата проверки: {business.npdCheckedAt ? formatAdminDateTime(business.npdCheckedAt) : "—"}</p>
                        <a href="https://lkfl.portal.nalog.gov.by/web/guest/check_registration" target="_blank" rel="noopener noreferrer" className="text-primary underline">Проверить НПД</a>
                        <p>Проверка регистрации НПД не подтверждает допустимость конкретной деятельности.</p>
                        {canRecordNpdCheck && business.verificationStatus === "PENDING" && <div className="flex flex-wrap gap-2">{[["CONFIRMED", "Подтверждено"], ["NOT_FOUND", "Не найдено"], ["UNAVAILABLE", "Не удалось проверить"]].map(([result, label]) => <Button variant="outline" key={result} type="button" disabled={actionLoading} onClick={() => void recordNpd(result)} className="rounded-md border border-border p-3 disabled:opacity-50">{label}</Button>)}</div>}
                      </div>}
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
                      {formatAdminDateTime(business.createdAt)}
                    </dd>
                  </div>
                  {business.submittedAt && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Дата подачи
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatAdminDateTime(business.submittedAt)}
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
                      {business.owner?.email || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Телефон</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {business.owner?.phoneE164 || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Дата регистрации
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatAdminDateTime(business.owner.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Access requests are distinct from registration verification. */}
              {canReviewAccessRequests && (
                <section className="rounded-lg border border-gray-200 bg-white p-4" aria-labelledby="business-access-requests-title">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 id="business-access-requests-title" className="text-lg font-semibold">
                      Запросы доступа к бизнесу
                    </h4>
                    <Link
                      href={adminPath("/b2b/access-requests")}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Все запросы
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Это отдельная проверка полномочий заявителя, не связанная со статусом верификации бизнеса.
                  </p>
                  {accessRequests.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">
                      Запросов доступа для этой компании не найдено.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {accessRequests.map((accessRequest) => (
                        <div key={accessRequest.id} className="rounded-md border border-gray-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium text-gray-900">{accessRequest.name}</div>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                              {ACCESS_REQUEST_STATUS_LABELS[accessRequest.status] ?? accessRequest.status}
                            </span>
                          </div>
                          <p className="mt-1 break-all text-xs text-gray-600">
                            {accessRequest.requesterUser.email} · {accessRequest.requesterRole} · {formatAdminDateTime(accessRequest.createdAt)}
                          </p>
                          <Link
                            href={adminPath(`/b2b/access-requests/${accessRequest.id}`)}
                            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                          >
                            {accessRequest.status === "PENDING" ? "Рассмотреть запрос" : "Открыть запрос"}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

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
                            {formatAdminDateTime(log.createdAt)}
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
                      <Textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={4}
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
      </SheetContent>
    </Sheet>
  );
}
