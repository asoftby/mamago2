import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/server";
import { getAdminOrderById } from "@/server/services/booking/adminOrders.service";
import { getAdminAuditLogsForEntity } from "@/server/services/adminAuditLog.service";
import {
  Role,
  type BookingStatus,
  type BillingTransactionStatus,
  type BillingTransactionType,
} from "@prisma/client";
import type { OrderFinancials } from "@/server/services/booking/adminOrders.service";

const STATUS_LABELS: Record<BookingStatus, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

const STATUS_BADGE_CLASS: Record<BookingStatus, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-stone-200 bg-stone-100 text-stone-700",
  COMPLETED: "border-violet-200 bg-violet-50 text-violet-700",
};

const TX_STATUS_LABELS: Record<BillingTransactionStatus, string> = {
  PENDING: "Ожидает",
  SUCCEEDED: "Выполнена",
  FAILED: "Ошибка",
  CANCELED: "Отменена",
  REVERSED: "Возвращена",
};

const TX_STATUS_CLASS: Record<BillingTransactionStatus, string> = {
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  SUCCEEDED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
  CANCELED: "border-stone-200 bg-stone-100 text-stone-700",
  REVERSED: "border-violet-200 bg-violet-50 text-violet-700",
};

const TX_TYPE_LABELS: Partial<Record<BillingTransactionType, string>> = {
  LEAD_CHARGE: "Списание за лид",
  REFUND: "Возврат",
  DEPOSIT_TOPUP: "Пополнение",
  SUBSCRIPTION_CHARGE: "Подписка",
  MANUAL_ADJUSTMENT: "Ручная корректировка",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: string, currency: string) {
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
}

function shortTxId(id: string) {
  return `#${id.slice(-8)}`;
}

function getPublicationHref(order: NonNullable<Awaited<ReturnType<typeof getAdminOrderById>>>) {
  if (!order.entityId) return null;
  if (order.entityType === "PLACE") return `/admin/content/places/${order.entityId}`;
  if (order.entityType === "EVENT") return `/admin/seo/pages/event/${order.entityId}`;
  if (order.entityType === "OFFER" || order.entityType === "CAMP_SHIFT") {
    return `/admin/seo/pages/offer/${order.entityId}`;
  }
  return null;
}

// ─── Finances block ───────────────────────────────────────────────────────────

function FinancesBlock({ financials }: { financials: OrderFinancials }) {
  const { debit, refunds } = financials;

  if (!debit) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Финансы</h2>
        <p className="text-sm text-gray-500">Списание по этой заявке не найдено.</p>
      </section>
    );
  }

  const billingHref = `/admin/billing/businesses/${debit.businessId}/billing`;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Финансы</h2>
        <Link
          href={billingHref}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Открыть в биллинге →
        </Link>
      </div>

      {/* Main debit transaction */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">
              {formatAmount(debit.amount, debit.currency)}
            </p>
            <p className="text-xs text-gray-500">
              {TX_TYPE_LABELS[debit.type] ?? debit.type}
            </p>
          </div>
          <Badge variant="outline" className={`text-xs ${TX_STATUS_CLASS[debit.status]}`}>
            {TX_STATUS_LABELS[debit.status] ?? debit.status}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>
            <span className="font-medium text-gray-700">Транзакция:</span>{" "}
            <Link
              href={billingHref}
              title={debit.id}
              className="text-blue-600 hover:text-blue-700 font-mono"
            >
              {shortTxId(debit.id)}
            </Link>
          </p>
          {debit.description && (
            <p>
              <span className="font-medium text-gray-700">Описание:</span>{" "}
              {debit.description}
            </p>
          )}
          <p>
            <span className="font-medium text-gray-700">Дата:</span>{" "}
            {formatDateTime(debit.occurredAt)}
          </p>
        </div>
      </div>

      {/* Refunds */}
      {refunds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Возвраты ({refunds.length})
          </p>
          {refunds.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 space-y-1"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-violet-800">
                  − {formatAmount(r.amount, r.currency)}
                </p>
                <Badge variant="outline" className={`text-xs ${TX_STATUS_CLASS[r.status]}`}>
                  {TX_STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p>
                  <span className="font-medium text-gray-700">Транзакция:</span>{" "}
                  <span className="font-mono" title={r.id}>
                    {shortTxId(r.id)}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">Дата:</span>{" "}
                  {formatDateTime(r.occurredAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN]);
  const { id } = await params;
  const order = await getAdminOrderById(id);
  const auditLogs = await getAdminAuditLogsForEntity("BOOKING_REQUEST", id);

  if (!order) {
    notFound();
  }

  const publicationHref = getPublicationHref(order);

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="space-y-2">
        <Link href="/admin/orders" className="text-sm text-blue-600 hover:text-blue-700">
          Назад к списку заказов
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-xl font-bold text-gray-900">
              Заявка {order.id}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Read-only детали заявки без изменения статуса и финансовых действий
            </p>
          </div>
          <Badge variant="outline" className={STATUS_BADGE_CLASS[order.status]}>
            {STATUS_LABELS[order.status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Client */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Клиент</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="font-medium text-gray-900">Имя:</span> {order.customerName}</p>
            <p><span className="font-medium text-gray-900">Телефон:</span> {order.customerPhone}</p>
            <p><span className="font-medium text-gray-900">Email:</span> {order.customerEmail || "—"}</p>
            <p><span className="font-medium text-gray-900">Создано:</span> {formatDateTime(order.createdAt)}</p>
            <p><span className="font-medium text-gray-900">Обновлено:</span> {formatDateTime(order.updatedAt)}</p>
          </div>
        </section>

        {/* Business & publication */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Бизнес и публикация</h2>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              <span className="font-medium text-gray-900">Бизнес:</span>{" "}
              <Link
                href={`/admin/b2b/partners/${order.business.id}`}
                className="text-blue-600 hover:text-blue-700"
              >
                {order.business.name}
              </Link>
            </p>
            <p>
              <span className="font-medium text-gray-900">Тип:</span> {order.entityType}
            </p>
            <p>
              <span className="font-medium text-gray-900">Публикация:</span>{" "}
              {publicationHref ? (
                <Link href={publicationHref} className="text-blue-600 hover:text-blue-700">
                  {order.entityTitle || "Открыть публикацию"}
                </Link>
              ) : (
                order.entityTitle || "—"
              )}
            </p>
            <p>
              <span className="font-medium text-gray-900">Source/channel:</span>{" "}
              {order.sourceChannel || "—"}
            </p>
          </div>
        </section>
      </div>

      {/* Finances */}
      <FinancesBlock financials={order.financials} />

      {/* Camp shift */}
      {order.campShiftSnapshot && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Снимок смены лагеря</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="font-medium text-gray-900">ID:</span> {order.campShiftSnapshot.id}</p>
            <p><span className="font-medium text-gray-900">Название:</span> {order.campShiftSnapshot.title || "—"}</p>
            <p><span className="font-medium text-gray-900">Дата начала:</span> {order.campShiftSnapshot.dateFrom ? formatDateTime(order.campShiftSnapshot.dateFrom) : "—"}</p>
            <p><span className="font-medium text-gray-900">Дата окончания:</span> {order.campShiftSnapshot.dateTo ? formatDateTime(order.campShiftSnapshot.dateTo) : "—"}</p>
          </div>
        </section>
      )}

      {/* Latest activity */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Последняя активность</h2>
        {order.latestActivity ? (
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="font-medium text-gray-900">Тип:</span> {order.latestActivity.type}</p>
            <p><span className="font-medium text-gray-900">Актор:</span> {order.latestActivity.actorType}</p>
            <p><span className="font-medium text-gray-900">Время:</span> {formatDateTime(order.latestActivity.createdAt)}</p>
            <p><span className="font-medium text-gray-900">Actor ID:</span> {order.latestActivity.actorId || "—"}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Активностей пока нет</p>
        )}
      </section>

      {/* Audit history */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Audit History</h2>
        {auditLogs.length > 0 ? (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-gray-500">
                      {log.actor?.email || "System / unknown actor"} · {log.actorRole}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{formatDateTime(log.createdAt.toISOString())}</p>
                </div>
                {log.reason ? (
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-medium text-gray-900">Причина:</span> {log.reason}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Before</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded-lg overflow-x-auto">
                      {JSON.stringify(log.before, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">After</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded-lg overflow-x-auto">
                      {JSON.stringify(log.after, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Аудит-история для этой заявки пока пуста</p>
        )}
      </section>
    </div>
  );
}
