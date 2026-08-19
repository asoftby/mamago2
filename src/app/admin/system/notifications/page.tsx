import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { emailService } from "@/features/email/server/email-service";
import { getTelegramConfig } from "@/server/config/telegram.config";
import { getTelegramDiagnostics } from "@/server/services/telegram/telegramDiagnostics.service";
import {
  reconcileStalePendingDeliveries,
  STALE_PENDING_THRESHOLD_MINUTES,
} from "@/server/services/notificationDelivery.service";
import {
  AdminNotificationTestButtons,
  ResendDeliveryButton,
} from "./AdminNotificationsDiagnosticsClient";
import { TableContainer } from "@/components/ui/table";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSystemNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer || viewer.role !== "ADMIN") {
    redirect("/admin");
  }

  const params = await searchParams;
  const type = firstParam(params.type);
  const audience = firstParam(params.audience);
  const channel = firstParam(params.channel);
  const status = firstParam(params.status);

  const notificationWhere = {
    ...(type && Object.values(NotificationType).includes(type as NotificationType)
      ? { type: type as NotificationType }
      : {}),
    ...(audience && Object.values(NotificationAudience).includes(audience as NotificationAudience)
      ? { audience: audience as NotificationAudience }
      : {}),
    ...((channel && Object.values(NotificationChannel).includes(channel as NotificationChannel)) ||
    (status && Object.values(NotificationDeliveryStatus).includes(status as NotificationDeliveryStatus))
      ? {
          deliveries: {
            some: {
              ...(channel ? { channel: channel as NotificationChannel } : {}),
              ...(status ? { status: status as NotificationDeliveryStatus } : {}),
            },
          },
        }
      : {}),
  };

  const deliveryWhere = {
    ...(channel && Object.values(NotificationChannel).includes(channel as NotificationChannel)
      ? { channel: channel as NotificationChannel }
      : {}),
    ...(status && Object.values(NotificationDeliveryStatus).includes(status as NotificationDeliveryStatus)
      ? { status: status as NotificationDeliveryStatus }
      : {}),
    ...(type && Object.values(NotificationType).includes(type as NotificationType)
      ? { notification: { type: type as NotificationType } }
      : {}),
  };

  // Lazy reconciliation: deliveries stuck in PENDING (process died between
  // upsert and the post-send update) become FAILED + STALE_PENDING_TIMEOUT
  // and get the manual Resend action below.
  const reconciledCount = await reconcileStalePendingDeliveries();

  const [notifications, deliveries, failedDeliveries, pendingCount] = await Promise.all([
    prisma.notification.findMany({
      where: notificationWhere,
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        user: { select: { email: true, role: true } },
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    }),
    prisma.notificationDelivery.findMany({
      where: deliveryWhere,
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        notification: {
          select: {
            id: true,
            type: true,
            title: true,
            audience: true,
          },
        },
        user: {
          select: { email: true },
        },
      },
    }),
    prisma.notificationDelivery.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        notification: {
          select: { id: true, type: true, title: true },
        },
      },
    }),
    prisma.notificationDelivery.count({
      where: { status: "PENDING", channel: { in: ["EMAIL", "TELEGRAM"] } },
    }),
  ]);

  const emailHealth = emailService.getHealth();
  const telegramConfig = getTelegramConfig();
  let telegramLive: Awaited<ReturnType<typeof getTelegramDiagnostics>> | null = null;
  try {
    telegramLive = await getTelegramDiagnostics();
  } catch (error) {
    console.error("[admin:notifications] telegram diagnostics failed", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-950">Система → Уведомления</h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-600">
            Последние уведомления, delivery-статусы по каналам, ручной resend и health-check без раскрытия секретов.
          </p>
        </div>
        <AdminNotificationTestButtons />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard
          title="Email"
          lines={[
            `EMAIL_ENABLED: ${emailHealth.enabled ? "ON" : "OFF"}`,
            `Configured: ${emailHealth.configured ? "YES" : "NO"}`,
            `Missing env: ${emailHealth.missingKeys.length > 0 ? emailHealth.missingKeys.join(", ") : "none"}`,
            `Debug redirect: ${emailHealth.debugRedirect ? "ON" : "OFF"}`,
            `From: ${emailHealth.from ?? "MISSING"}`,
            `Reply-To: ${emailHealth.replyTo ?? "MISSING"}`,
            `Public URL: ${emailHealth.publicUrl ?? "MISSING"}`,
          ]}
        />
        <HealthCard
          title="Telegram"
          lines={[
            `Environment: ${telegramConfig.environment}`,
            `Bot token: ${telegramConfig.botToken ? "SET" : "MISSING"}`,
            `Configured username: ${telegramConfig.botUsername ? `@${telegramConfig.botUsername}` : "MISSING"}`,
            `getMe username: ${telegramLive?.botUsername ? `@${telegramLive.botUsername}` : telegramLive?.botError ?? "n/a"}`,
            `Webhook secret: ${telegramConfig.webhookSecret ? "SET" : "MISSING"}`,
            `Webhook URL: ${telegramLive?.webhook?.url || "(empty)"}`,
            `Expected webhook: ${telegramLive?.expectedWebhookUrl ?? "unknown"}`,
            `Webhook match: ${
              telegramLive?.urlStatus.kind === "ok"
                ? "YES"
                : telegramLive?.urlStatus.kind === "mismatch"
                  ? "NO"
                  : telegramLive?.urlStatus.kind ?? "n/a"
            }`,
            `pending_update_count: ${telegramLive?.webhook?.pendingUpdateCount ?? "n/a"}`,
            `last error: ${telegramLive?.webhook?.lastErrorMessage ?? "none"}`,
          ]}
        />
        <HealthCard
          title="Summary"
          lines={[
            `Notifications shown: ${notifications.length}`,
            `Deliveries shown: ${deliveries.length}`,
            `Failed deliveries: ${failedDeliveries.length}`,
            `Pending (in flight, <${STALE_PENDING_THRESHOLD_MINUTES}m): ${pendingCount}`,
            `Stale PENDING → FAILED at this load: ${reconciledCount}`,
          ]}
        />
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5">
        <form className="grid gap-3 md:grid-cols-4">
          <FilterSelect label="Type" name="type" value={type}>
            <option value="">All</option>
            {Object.values(NotificationType).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Audience" name="audience" value={audience}>
            <option value="">All</option>
            {Object.values(NotificationAudience).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Channel" name="channel" value={channel}>
            <option value="">All</option>
            {Object.values(NotificationChannel).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Status" name="status" value={status}>
            <option value="">All</option>
            {Object.values(NotificationDeliveryStatus).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <div className="md:col-span-4 flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white"
            >
              Применить
            </button>
            <Link href="/admin/system/notifications" className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
              Сбросить
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-stone-950">Последние Notification</h2>
        <div className="mt-4">
          <TableContainer
            minWidthClassName="min-w-[720px]"
            scrollLabel="Таблица последних уведомлений, прокручивается по горизонтали"
          >
          <table className="min-w-full text-sm">
            <thead className="text-left text-stone-500">
              <tr>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Audience</th>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Entity</th>
                <th className="pb-2 pr-4">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id} className="border-t border-stone-100 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-stone-500">
                    {notification.createdAt.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-stone-900">{notification.type}</div>
                    <div className="text-xs text-stone-500">{notification.title}</div>
                  </td>
                  <td className="py-3 pr-4">{notification.audience ?? "USER"}</td>
                  <td className="py-3 pr-4">{notification.user.email ?? notification.user.role}</td>
                  <td className="py-3 pr-4 text-xs text-stone-600">
                    {notification.entityType ?? "—"} / {notification.entityId ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs text-stone-600">
                    {notification.deliveries.length === 0 ? "—" : notification.deliveries.map((delivery) => (
                      <div key={delivery.id}>
                        {delivery.channel}: {delivery.status}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-stone-950">NotificationDelivery</h2>
        <div className="mt-4">
          <TableContainer
            minWidthClassName="min-w-[820px]"
            scrollLabel="Таблица доставок уведомлений, прокручивается по горизонтали"
          >
          <table className="min-w-full text-sm">
            <thead className="text-left text-stone-500">
              <tr>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2 pr-4">Channel</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Notification</th>
                <th className="pb-2 pr-4">Recipient</th>
                <th className="pb-2 pr-4">Error</th>
                <th className="pb-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="border-t border-stone-100 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-stone-500">
                    {delivery.createdAt.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-3 pr-4">{delivery.channel}</td>
                  <td className="py-3 pr-4">{delivery.status}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-stone-900">{delivery.notification?.type ?? "—"}</div>
                    <div className="text-xs text-stone-500">{delivery.notification?.title ?? "Без notification row"}</div>
                  </td>
                  <td className="py-3 pr-4">{delivery.user.email ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs text-rose-700">{delivery.errorMessage ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {delivery.status === "FAILED" &&
                    (delivery.channel === "EMAIL" || delivery.channel === "TELEGRAM") ? (
                      <ResendDeliveryButton deliveryId={delivery.id} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableContainer>
        </div>
      </section>
    </div>
  );
}

function HealthCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5">
      <h2 className="text-base font-semibold text-stone-950">{title}</h2>
      <div className="mt-3 space-y-1 text-sm text-stone-600">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className="text-sm text-stone-700">
      <span className="mb-1 block">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
      >
        {children}
      </select>
    </label>
  );
}
