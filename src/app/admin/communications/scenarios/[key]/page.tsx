import type { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";
import { Bell, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPath } from "@/lib/routing/surface";
import { prisma } from "@/lib/prisma";
import { getNotificationPolicyByKey } from "@/server/services/notificationPolicy.service";
import { renderNotificationContentCore } from "@/server/notifications/notification-renderer-core";
import { getNotificationRegistryEntry } from "@/lib/notifications/notificationRegistry";
import { getNotificationScenarioDefinition } from "@/lib/notifications/notificationRegistry";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import { getCurrentUser } from "@/lib/auth/server";
import type {
  NotificationScenario,
  RenderedNotificationContent,
  SendNotificationContext,
} from "@/lib/notifications/domainContracts";
import { getScenarioMeta } from "../scenario-meta";
import { ScenarioEnabledToggle, ScenarioTestSendButton } from "./ScenarioPageActions";
import { ScenarioTabNav } from "./ScenarioTabNav";
import { TemplatesTab, type SavedTemplate, type ScenarioDefinitionProps } from "./TemplatesTab";
import { PolicyEditForm } from "./PolicyEditForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageParams = Promise<{ key: string }>;
type PageSearchParams = Promise<{ tab?: string; channel?: string }>;

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


function buildPreviewContext(scenario: NotificationScenario): SendNotificationContext {
  const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);

  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return {
        planItemId: "preview",
        activityId: null,
        eventTitle: "Детская йога в парке",
        startsAt: inTwoHours,
        placeName: "Парк Горького",
        cityName: "Минск",
      };
    case "PLAN_TOMORROW_DIGEST":
      return {
        digestDate: "preview",
        planItemIds: [],
        items: [
          {
            planItemId: "preview-1",
            eventTitle: "Детская йога в парке",
            startsAt: inTwoHours,
            placeName: "Парк Горького",
          },
          {
            planItemId: "preview-2",
            eventTitle: "Мастер-класс по лепке",
            startsAt: new Date(inTwoHours.getTime() + 3 * 60 * 60 * 1000),
            placeName: "Студия «Глина»",
          },
        ],
      };
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}


function NotificationPreview({ content }: { content: RenderedNotificationContent }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
      <div className="text-sm font-semibold text-stone-900">{content.title}</div>
      <div className="mt-2 whitespace-pre-line text-sm text-stone-700">{content.body}</div>
      {content.ctaLabel ? (
        <div className="mt-3 inline-flex rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-medium text-white">
          {content.ctaLabel}
        </div>
      ) : null}
    </div>
  );
}

export default async function AdminScenarioPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: PageSearchParams;
}) {
  const { key } = await params;
  const { tab = "policy", channel } = await searchParams;

  const policy = await getNotificationPolicyByKey(key);
  if (!policy) notFound();

  const meta = getScenarioMeta(policy.key);
  const Icon = meta.icon;
  const isScenarioPipeline = Boolean(policy.scenario);
  const registryEntry = policy.notificationType
    ? getNotificationRegistryEntry(policy.notificationType)
    : null;

  const previewContent = policy.scenario
    ? renderNotificationContentCore(policy.scenario, buildPreviewContext(policy.scenario))
    : null;

  // Templates tab data — only fetched when needed
  const definition = getNotificationScenarioDefinition(key);
  // Extract plain serializable props — Zod payloadSchema cannot cross the RSC boundary
  const scenarioDef: ScenarioDefinitionProps | null = definition
    ? {
        variables: Object.keys(definition.payloadSchema.shape),
        defaults: definition.defaults,
      }
    : null;
  let savedTemplates: SavedTemplate[] = [];
  let hasTelegramLinked = false;

  if (tab === "templates" && definition) {
    const [dbTemplates, currentUser] = await Promise.all([
      prisma.notificationTemplate.findMany({
        where: { scenarioKey: key },
        select: {
          channel: true,
          subject: true,
          body: true,
          updatedAt: true,
          updatedByUser: { select: { email: true } },
        },
      }),
      getCurrentUser(),
    ]);

    savedTemplates = dbTemplates.map((t) => ({
      channel: t.channel as SavedTemplate["channel"],
      subject: t.subject,
      body: t.body,
      updatedAt: t.updatedAt.toISOString(),
      updatedByEmail: t.updatedByUser?.email ?? null,
    }));

    if (currentUser) {
      const telegramStatus = await getTelegramLinkStatus({ userId: currentUser.id });
      hasTelegramLinked = telegramStatus.linked;
    }
  }

  // Deliveries — only for policy tab
  let deliveries: Array<{
    id: string;
    channel: NotificationChannel;
    status: NotificationDeliveryStatus;
    sentAt: Date | null;
    createdAt: Date;
    errorMessage: string | null;
    user: { id: string; email: string | null; telegramUsername: string | null };
  }> = [];

  if (tab === "policy") {
    deliveries = await prisma.notificationDelivery.findMany({
      where: policy.scenario
        ? { scenario: policy.scenario }
        : policy.notificationType
          ? { notification: { type: policy.notificationType } }
          : { id: "__none__" },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      include: {
        user: { select: { id: true, email: true, telegramUsername: true } },
      },
    });
  }

  const deliveriesHref = policy.scenario
    ? adminPath(`/communications/notifications/deliveries?scenario=${policy.scenario}`)
    : adminPath("/communications/notifications/deliveries");

  const activeTab = tab === "templates" ? "templates" : "policy";
  const initialChannel =
    (["IN_APP", "EMAIL", "TELEGRAM"] as const).find(
      (ch) => ch.toLowerCase() === channel?.toLowerCase(),
    ) ?? "IN_APP";

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        showBackButton
        backHref={adminPath("/communications/notifications")}
        actions={
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-1">
              <ScenarioEnabledToggle policyId={policy.id} initialEnabled={policy.enabled} />
              <span className="text-xs text-amber-600">пока не влияет на отправку</span>
            </div>
            <ScenarioTestSendButton
              scenarioKey={policy.key}
              disabled={!isScenarioPipeline}
              disabledReason="Тест доступен только для сценариев нового пайплайна"
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1">
          <Icon className="h-3.5 w-3.5" />
          {policy.key}
        </span>
        <span className="rounded-full bg-stone-100 px-2.5 py-1">Surface: {policy.surface}</span>
        {policy.notificationType ? (
          <span className="rounded-full bg-stone-100 px-2.5 py-1">
            Type: {policy.notificationType}
          </span>
        ) : null}
        {isScenarioPipeline ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            Сценарный пайплайн
          </span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            Legacy-пайплайн
          </span>
        )}
      </div>

      <ScenarioTabNav scenarioKey={key} activeTab={activeTab} channel={channel} />

      {activeTab === "policy" && (
        <div className="space-y-6">
          <PolicyEditForm policy={policy} />

          {/* Code-default preview (legacy / scenario pipelines) */}
          <Card className="rounded-3xl border-stone-200/90">
            <CardHeader>
              <CardTitle>Текущий системный рендер</CardTitle>
              <CardDescription>
                Что реально уходит пользователю прямо сейчас (код-дефолт без override-шаблонов).
                Шаблон-override задаётся на вкладке «Шаблоны».
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <Bell className="h-4 w-4 text-stone-500" />
                  In-app
                </div>
                {previewContent ? (
                  <>
                    <NotificationPreview content={previewContent} />
                    <p className="text-xs text-muted-foreground">
                      Текст задаётся системным рендерером (notification-renderer-core).
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-stone-600">
                    Текст формируется legacy-пайплайном в момент события
                    {registryEntry ? <> (реестр: «{registryEntry.label}»)</> : null}.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <Mail className="h-4 w-4 text-stone-500" />
                  Email
                </div>
                <p className="text-sm text-stone-600">
                  Письмо собирается системным рендерером (sendNotificationEmail): заголовок, текст и
                  CTA из уведомления.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <MessageCircle className="h-4 w-4 text-stone-500" />
                  Telegram
                </div>
                {previewContent ? (
                  <>
                    <NotificationPreview content={previewContent} />
                    <p className="text-xs text-muted-foreground">
                      Сообщение: заголовок + текст, одна url-кнопка CTA.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-stone-600">
                    Сообщение рендерится из notification registry
                    {registryEntry?.telegram?.title ? (
                      <> («{registryEntry.telegram.title}»)</>
                    ) : null}
                    .
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deliveries table */}
          <Card className="rounded-3xl border-stone-200/90">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Последние отправки</CardTitle>
                  <CardDescription>
                    {isScenarioPipeline
                      ? "Последние 20 deliveries этого сценария."
                      : `Последние 20 deliveries по типу ${policy.notificationType ?? "—"} (legacy-пайплайн).`}
                  </CardDescription>
                </div>
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href={deliveriesHref}>
                    Все отправки
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="px-3 py-3 font-medium">User</th>
                    <th className="px-3 py-3 font-medium">Channel</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Sent at</th>
                    <th className="px-3 py-3 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-stone-500">
                        Отправок пока нет.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((delivery) => {
                      const userLabel = delivery.user.telegramUsername
                        ? `@${delivery.user.telegramUsername}`
                        : delivery.user.email || delivery.user.id;

                      return (
                        <tr
                          key={delivery.id}
                          className="border-b border-stone-100 align-top last:border-b-0"
                        >
                          <td className="px-3 py-3 text-stone-900">{userLabel}</td>
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "templates" && scenarioDef && (
        <TemplatesTab
          scenarioKey={key}
          scenarioDef={scenarioDef}
          savedTemplates={savedTemplates}
          initialChannel={initialChannel}
          hasTelegramLinked={hasTelegramLinked}
        />
      )}

      {activeTab === "templates" && !scenarioDef && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-800">
          Определение сценария не найдено в реестре — шаблоны недоступны.
        </div>
      )}
    </div>
  );
}
