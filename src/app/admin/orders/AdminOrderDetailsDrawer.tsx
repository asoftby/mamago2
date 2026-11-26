"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { adminPath } from "@/lib/routing/surface";
import type { getAdminOrderById } from "@/server/services/booking/adminOrders.service";

type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrderById>>>;
type AuditRow = {
  id: string;
  action: string;
  actorRole: string;
  actor: { email: string | null } | null;
  createdAt: string;
  reason: string | null;
  before: unknown;
  after: unknown;
};
type DetailResponse = { order: AdminOrderDetail; auditLogs: AuditRow[] };

const STATUS_LABELS: Record<string, string> = {
  NEW: "Ждёт подтверждения",
  EXPIRED: "Время ответа истекло",
  CONFIRMED: "Подтверждено",
  REJECTED: "Отклонено",
  CANCELLED: "Отменено",
  COMPLETED: "Завершено",
};
const DELIVERY_LABELS: Record<string, string> = {
  SENT: "Отправлено",
  FAILED: "Ошибка отправки",
  SKIPPED: "Пропущено — не отправлено",
  PENDING: "В очереди",
  NOT_CREATED: "Нет записи об отправке",
};
const DELIVERY_TONES: Record<string, string> = {
  SENT: "text-emerald-700",
  FAILED: "text-red-700",
  SKIPPED: "text-amber-700",
  PENDING: "text-sky-700",
  NOT_CREATED: "text-stone-600",
};
const SENDER_LABELS: Record<string, string> = {
  BUSINESS: "Бизнес",
  CUSTOMER: "Клиент",
  ADMIN: "Администратор",
  SYSTEM: "Система",
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    timeZone: "Europe/Minsk",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="font-semibold text-stone-950">{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-3 text-sm">
      <span className="text-stone-500">{label}</span>
      <div className="min-w-0 break-words font-medium text-stone-900">{children}</div>
    </div>
  );
}

/**
 * Admin detail is deliberately read-only. Changing booking status is a
 * business permission, not an admin capability.
 */
export function AdminOrderDetailsDrawer({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/orders/${encodeURIComponent(orderId)}`,
          { cache: "no-store", credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Не удалось загрузить заявку (HTTP ${response.status})`);
        const result = await response.json() as DetailResponse;
        if (!controller.signal.aborted) setData(result);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Ошибка загрузки заявки");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [orderId]);

  const order = data?.order ?? null;
  const phone = order?.businessContact.phone || order?.businessContact.verifiedContactPhone || null;
  // Contact the provider directly; do not send customer PII or mutate the order.
  const reminderEmail = order?.businessContact.ownerEmail && order
    ? `mailto:${order.businessContact.ownerEmail}?subject=${encodeURIComponent(`mamaGo · заявка № ${order.requestNumber} ждёт подтверждения`)}&body=${encodeURIComponent(`Здравствуйте! На mamaGo ожидает решения заявка № ${order.requestNumber} по публикации «${order.entityTitle || "Ваша публикация"}». Пожалуйста, подтвердите или отклоните её в бизнес-кабинете. Спасибо!`)}`
    : null;
  return (
    <Sheet open={orderId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="!w-full !max-w-[760px] gap-0 overflow-hidden border-l border-stone-200 bg-stone-50 p-0"
        aria-describedby="admin-order-sheet-description"
      >
        <SheetHeader className="shrink-0 border-b border-stone-200 bg-white px-5 py-4 pr-14">
          <SheetTitle>
            {order ? `Заявка № ${order.requestNumber}` : "Заявка"}
          </SheetTitle>
          <SheetDescription id="admin-order-sheet-description">
            Контроль заявки, контакты бизнеса, сообщения и история доставки · без изменения статуса
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {loading ? <p role="status" className="text-sm text-stone-600">Загружаем заявку…</p> : null}
          {error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {order ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline">{STATUS_LABELS[order.status] ?? order.status}</Badge>
                <span className="text-xs text-stone-500">Создана {dateLabel(order.createdAt)}</span>
              </div>

              <DetailSection title="Клиент">
                <InfoRow label="Имя">{order.customerName || "—"}</InfoRow>
                <InfoRow label="Телефон">
                  {order.customerPhone ? <a className="text-blue-700 underline" href={`tel:${order.customerPhone}`}>{order.customerPhone}</a> : "—"}
                </InfoRow>
                <InfoRow label="Email">
                  {order.customerEmail ? <a className="text-blue-700 underline" href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a> : "—"}
                </InfoRow>
                <InfoRow label="Публикация">{order.entityTitle || "—"}</InfoRow>
                <InfoRow label="Источник">{order.sourceChannel || "—"}</InfoRow>
                <InfoRow label="Срок ответа бизнеса">{dateLabel(order.responseDueAt)}</InfoRow>
              </DetailSection>

              <DetailSection title="Бизнес · контакты для связи">
                <InfoRow label="Организация">
                  <Link className="text-blue-700 underline" href={adminPath(`/b2b/partners/${order.business.id}`)}>
                    {order.businessContact.name}
                  </Link>
                </InfoRow>
                {order.businessContact.legalName ? (
                  <InfoRow label="Юридическое название">{order.businessContact.legalName}</InfoRow>
                ) : null}
                <InfoRow label="Рабочий телефон">
                  {order.businessContact.phone
                    ? <a className="text-blue-700 underline" href={`tel:${order.businessContact.phone}`}>{order.businessContact.phone}</a>
                    : "Не указан"}
                </InfoRow>
                {order.businessContact.verifiedContactPhone ? (
                  <InfoRow label="Подтверждённый контакт">
                    <a className="text-blue-700 underline" href={`tel:${order.businessContact.verifiedContactPhone}`}>
                      {order.businessContact.verifiedContactPhone}
                    </a>
                  </InfoRow>
                ) : null}
                {order.businessContact.ownerName ? (
                  <InfoRow label="Ответственный">{order.businessContact.ownerName}</InfoRow>
                ) : null}
                <InfoRow label="Email владельца">
                  {order.businessContact.ownerEmail ? (
                    <a className="text-blue-700 underline" href={`mailto:${order.businessContact.ownerEmail}`}>
                      {order.businessContact.ownerEmail}
                    </a>
                  ) : "Не указан"}
                </InfoRow>
                <div className="flex flex-wrap gap-2 pt-2">
                  {phone ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={`tel:${phone}`}>Позвонить бизнесу</a>
                    </Button>
                  ) : null}
                  {order.businessContact.ownerEmail ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={reminderEmail ?? `mailto:${order.businessContact.ownerEmail}`}>Напомнить по email</a>
                    </Button>
                  ) : null}
                </div>
              </DetailSection>

              <DetailSection title="Telegram · доставка бизнесу">
                {order.telegramDeliveries.length ? order.telegramDeliveries.map((delivery) => (
                  <div key={delivery.notificationId} className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-all text-stone-600">{delivery.recipientEmail}</span>
                      <span className={`font-semibold ${DELIVERY_TONES[delivery.status] ?? "text-stone-600"}`}>
                        {DELIVERY_LABELS[delivery.status] ?? delivery.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {delivery.sentAt ? `Отправлено: ${dateLabel(delivery.sentAt)}` :
                        `Уведомление создано: ${dateLabel(delivery.createdAt)}`}
                      {" · "}Попыток: {delivery.attemptCount}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-amber-700">Уведомление бизнесу не найдено.</p>
                )}
                <p className="text-xs text-stone-500">
                  SKIPPED означает, что Telegram-сообщение не было отправлено.
                  Доставка внутри сайта отслеживается отдельно.
                </p>
              </DetailSection>

              <DetailSection title="Прямые сообщения">
                {order.directConversations.length ? (
                  <div className="space-y-3">
                    {order.directConversations.map((thread) => (
                      <div key={thread.id} className="space-y-2 rounded-xl border border-stone-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">Диалог D-{thread.threadNumber}</span>
                          <span className="text-xs text-stone-500">{thread.status}</span>
                        </div>
                        {thread.linkedToOrder ? (
                          <span className="text-xs font-medium text-blue-700">Связан с этой заявкой</span>
                        ) : (
                          <span className="text-xs text-stone-500">Другой диалог клиента с этой организацией</span>
                        )}
                        {thread.messages.map((message) => (
                          <div key={message.id} className="rounded-lg bg-stone-50 p-2 text-xs">
                            <span className="font-medium">{SENDER_LABELS[message.senderType] ?? message.senderType}</span>
                            <span className="ml-2 text-stone-400">{dateLabel(message.createdAt)}</span>
                            <p className="mt-1 whitespace-pre-wrap break-words text-stone-700">{message.body}</p>
                          </div>
                        ))}
                        <Link
                          className="inline-block text-sm font-semibold text-blue-700 underline"
                          href={adminPath(`/communications/direct/dialogs/${thread.id}`)}
                        >
                          Открыть всю переписку
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">Direct-переписка клиента с этим бизнесом не найдена.</p>
                )}
                <Link className="inline-block text-sm font-semibold text-blue-700 underline"
                  href={adminPath("/communications/direct/dialogs")}>
                  Все диалоги · Коммуникации
                </Link>
              </DetailSection>

              {order.campShiftSnapshot ? (
                <DetailSection title="Смена лагеря">
                  <InfoRow label="Смена">{order.campShiftSnapshot.title || "—"}</InfoRow>
                  <InfoRow label="Дата начала">{dateLabel(order.campShiftSnapshot.dateFrom)}</InfoRow>
                  <InfoRow label="Дата окончания">{dateLabel(order.campShiftSnapshot.dateTo)}</InfoRow>
                </DetailSection>
              ) : null}

              <DetailSection title="Финансы">
                {order.financials.debit ? (
                  <>
                    <InfoRow label="Сумма">{order.financials.debit.amount} {order.financials.debit.currency}</InfoRow>
                    <InfoRow label="Операция">{order.financials.debit.type}</InfoRow>
                    <InfoRow label="Статус">{order.financials.debit.status}</InfoRow>
                    <InfoRow label="Дата">{dateLabel(order.financials.debit.occurredAt)}</InfoRow>
                    <Link className="inline-block text-sm text-blue-700 underline"
                      href={adminPath(`/billing/businesses/${order.financials.debit.businessId}/billing`)}>
                      Открыть биллинг организации
                    </Link>
                    {order.financials.refunds.length ? (
                      <div className="space-y-2 border-t border-stone-100 pt-3">
                        <h4 className="text-sm font-medium">Возвраты</h4>
                        {order.financials.refunds.map((refund) => (
                          <div key={refund.id} className="rounded-lg bg-stone-50 p-2 text-sm">
                            {refund.amount} {refund.currency} · {refund.status} · {dateLabel(refund.occurredAt)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : <p className="text-sm text-stone-500">Списания по заявке не найдены.</p>}
              </DetailSection>

              <DetailSection title="История">
                {order.latestActivity ? (
                  <p className="text-sm text-stone-600">
                    {order.latestActivity.type} · {dateLabel(order.latestActivity.createdAt)}
                  </p>
                ) : null}
                {data?.auditLogs.length ? data.auditLogs.map((log) => (
                  <details key={log.id} className="rounded-lg border border-stone-100 p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      {log.action} · {dateLabel(log.createdAt)}
                    </summary>
                    <p className="mt-2 text-stone-600">
                      {log.actor?.email ?? log.actorRole}{log.reason ? ` · ${log.reason}` : ""}
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-stone-50 p-2 text-xs">
                      {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                    </pre>
                  </details>
                )) : (
                  <p className="text-sm text-stone-500">Дополнительных записей аудита нет.</p>
                )}
              </DetailSection>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
