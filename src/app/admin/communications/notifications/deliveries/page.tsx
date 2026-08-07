import Link from "next/link";
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationScenario,
  Prisma,
} from "@prisma/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableContainer } from "@/components/ui/table";
import { adminPath } from "@/lib/routing/surface";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SCENARIO_OPTIONS: NotificationScenario[] = [
  "PLAN_EVENT_2H_BEFORE",
  "PLAN_TOMORROW_DIGEST",
];
const CHANNEL_OPTIONS: NotificationChannel[] = ["IN_APP", "EMAIL", "TELEGRAM"];
const STATUS_OPTIONS: NotificationDeliveryStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED"];

type SearchParamsInput = Promise<{
  scenario?: string;
  channel?: string;
  status?: string;
}>;

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-BY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function isScenario(value: string | undefined): value is NotificationScenario {
  return Boolean(value && SCENARIO_OPTIONS.includes(value as NotificationScenario));
}

function isChannel(value: string | undefined): value is NotificationChannel {
  return Boolean(value && CHANNEL_OPTIONS.includes(value as NotificationChannel));
}

function isStatus(value: string | undefined): value is NotificationDeliveryStatus {
  return Boolean(value && STATUS_OPTIONS.includes(value as NotificationDeliveryStatus));
}

function statusTone(status: NotificationDeliveryStatus): string {
  switch (status) {
    case "SENT":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "FAILED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "SKIPPED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "PENDING":
    default:
      return "bg-stone-50 text-stone-700 border-stone-200";
  }
}

function buildWhere(params: {
  scenario?: NotificationScenario;
  channel?: NotificationChannel;
  status?: NotificationDeliveryStatus;
}): Prisma.NotificationDeliveryWhereInput {
  return {
    ...(params.scenario ? { scenario: params.scenario } : {}),
    ...(params.channel ? { channel: params.channel } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
}

export default async function AdminNotificationDeliveriesPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedScenario = isScenario(resolvedSearchParams.scenario)
    ? resolvedSearchParams.scenario
    : undefined;
  const selectedChannel = isChannel(resolvedSearchParams.channel)
    ? resolvedSearchParams.channel
    : undefined;
  const selectedStatus = isStatus(resolvedSearchParams.status)
    ? resolvedSearchParams.status
    : undefined;

  const where = buildWhere({
    scenario: selectedScenario,
    channel: selectedChannel,
    status: selectedStatus,
  });

  const deliveries = await prisma.notificationDelivery.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          telegramUsername: true,
        },
      },
      notification: {
        select: {
          id: true,
          entityId: true,
          title: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Notification Deliveries"
        subtitle="Минимальная видимость по MVP уведомлениям: что отправилось, что не отправилось и почему."
        showBackButton
        backHref={adminPath("/communications")}
      />

      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>
            Оставили только базовые срезы для MVP: сценарий, канал и статус.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-stone-500">Scenario</span>
              <select
                name="scenario"
                defaultValue={selectedScenario ?? ""}
                className="h-10 w-full rounded-2xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-stone-400"
              >
                <option value="">Все сценарии</option>
                {SCENARIO_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-stone-500">Channel</span>
              <select
                name="channel"
                defaultValue={selectedChannel ?? ""}
                className="h-10 w-full rounded-2xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-stone-400"
              >
                <option value="">Все каналы</option>
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-stone-500">Status</span>
              <select
                name="status"
                defaultValue={selectedStatus ?? ""}
                className="h-10 w-full rounded-2xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-stone-400"
              >
                <option value="">Все статусы</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="rounded-2xl">
                Применить
              </Button>
              <Button asChild type="button" variant="outline" className="rounded-2xl">
                <Link href={adminPath("/communications/notifications/deliveries")}>Сбросить</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Доставки</CardTitle>
          <CardDescription>
            Показываем последние 100 delivery attempts по текущим фильтрам.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableContainer
            minWidthClassName="min-w-[820px]"
            scrollLabel="Таблица доставок уведомлений, прокручивается по горизонтали"
          >
          <table className="min-w-full text-sm">
            <thead className="text-left text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Scenario</th>
                <th className="px-3 py-3 font-medium">Channel</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Sent at</th>
                <th className="px-3 py-3 font-medium">Error</th>
                <th className="px-3 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-stone-500">
                    По текущим фильтрам доставок пока нет.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => {
                  const userLabel =
                    delivery.user.telegramUsername
                      ? `@${delivery.user.telegramUsername}`
                      : delivery.user.email || delivery.user.id;

                  return (
                    <tr
                      key={delivery.id}
                      className="border-b border-stone-100 align-top last:border-b-0"
                    >
                      <td className="px-3 py-3 text-stone-900">{userLabel}</td>
                      <td className="px-3 py-3 text-stone-700">
                        {delivery.scenario ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-stone-700">{delivery.channel}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(delivery.status)}`}
                        >
                          {delivery.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        {formatDateTime(delivery.sentAt ?? delivery.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-stone-600">
                        {delivery.errorMessage || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <details className="group rounded-2xl border border-stone-200 bg-stone-50/70 px-3 py-2">
                          <summary className="cursor-pointer list-none text-xs font-medium text-stone-700">
                            Открыть
                          </summary>
                          <div className="mt-3 space-y-3 text-xs text-stone-600">
                            <div>
                              <div className="font-medium text-stone-800">Notification</div>
                              <div>ID: {delivery.notification?.id ?? "—"}</div>
                              <div>Title: {delivery.notification?.title ?? "—"}</div>
                            </div>
                            <div>
                              <div className="font-medium text-stone-800">Links</div>
                              <div>Dedupe key: {delivery.dedupeKey || "—"}</div>
                              <div>Related entity: {delivery.notification?.entityId || "—"}</div>
                            </div>
                            <div>
                              <div className="font-medium text-stone-800">Payload</div>
                              <pre className="mt-1 overflow-x-auto rounded-xl bg-white p-3 text-[11px] leading-5 text-stone-700">
                                {delivery.payloadJson
                                  ? JSON.stringify(delivery.payloadJson, null, 2)
                                  : "—"}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </TableContainer>
        </CardContent>
      </Card>
    </div>
  );
}
