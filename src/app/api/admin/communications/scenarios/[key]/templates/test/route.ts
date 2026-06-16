import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getNotificationScenarioDefinition } from "@/lib/notifications/notificationRegistry";
import {
  renderTemplateForChannelCore,
  toPlainText,
  type TemplateRenderChannel,
} from "@/server/notifications/template-render-core";
import { emailService } from "@/features/email/server/email-service";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";
import { prisma } from "@/lib/prisma";
import { resolveNotificationTypeForScenario } from "@/server/notifications/notification-scenario";
import {
  NOTIFICATION_SCENARIOS,
  type NotificationScenario,
} from "@/lib/notifications/domainContracts";

export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

type RouteParams = Promise<{ key: string }>;

const ALLOWED_CHANNELS = new Set<TemplateRenderChannel>(["IN_APP", "EMAIL", "TELEGRAM"]);

function isScenarioKey(key: string): key is NotificationScenario {
  return Object.values(NOTIFICATION_SCENARIOS).includes(key as NotificationScenario);
}

/**
 * POST /api/admin/communications/scenarios/[key]/templates/test
 * Body: { channel, subject?: string|null, body: string }
 *
 * Renders the given template with the scenario's samplePayload and delivers
 * it to the calling admin on the specified channel only (not all channels).
 * Goes through the same sanitizer pipeline as live sends. Admin-only.
 */
export async function POST(req: Request, { params }: { params: RouteParams }) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const limit = checkRateLimit(`admin-template-test:${auth.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подожди минуту и повтори." },
      { status: 429 },
    );
  }

  const { key } = await params;
  const reqBody = (await req.json().catch(() => null)) as unknown;

  if (!reqBody || typeof reqBody !== "object" || Array.isArray(reqBody)) {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const { channel: rawChannel, subject: rawSubject, body: rawBody } = reqBody as Record<
    string,
    unknown
  >;

  const channel =
    typeof rawChannel === "string" && ALLOWED_CHANNELS.has(rawChannel as TemplateRenderChannel)
      ? (rawChannel as TemplateRenderChannel)
      : null;

  if (!channel) {
    return NextResponse.json(
      { error: "channel должен быть IN_APP, EMAIL или TELEGRAM" },
      { status: 400 },
    );
  }

  if (typeof rawBody !== "string" || !rawBody.trim()) {
    return NextResponse.json({ error: "body обязателен" }, { status: 400 });
  }

  const definition = getNotificationScenarioDefinition(key);
  if (!definition) {
    return NextResponse.json({ error: "Сценарий не найден в реестре" }, { status: 404 });
  }

  const subject = rawSubject === null || rawSubject === undefined ? null : String(rawSubject);
  const allowedVariables = Object.keys(definition.payloadSchema.shape);

  let rendered: { subject: string | null; body: string };
  try {
    rendered = renderTemplateForChannelCore({
      channel,
      subjectTemplate: subject,
      bodyTemplate: rawBody,
      payload: definition.samplePayload,
      allowedVariables,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка рендера шаблона" },
      { status: 422 },
    );
  }

  try {
    if (channel === "EMAIL") {
      if (!auth.email) {
        return NextResponse.json(
          { error: "Email администратора не задан" },
          { status: 400 },
        );
      }
      const result = await emailService.sendNotificationEmail({
        to: auth.email,
        subject: rendered.subject ?? "Тестовое уведомление",
        title: rendered.subject ?? "Тестовое уведомление",
        body: toPlainText(rendered.body, 2000),
        bodyHtml: rendered.body,
      });
      if (result.status !== "SENT") {
        return NextResponse.json(
          { error: `Email пропущен: ${result.reason ?? result.status}` },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true, channel, status: "SENT" });
    }

    if (channel === "TELEGRAM") {
      const connection = await getActiveTelegramConnectionForCurrentEnvironment(auth.id);
      const conn = connection as { isActive?: boolean; telegramChatId?: string } | null;
      if (!conn?.isActive || !conn.telegramChatId) {
        return NextResponse.json({ error: "Telegram не подключён" }, { status: 400 });
      }
      const tg = new TelegramChannel();
      await tg.sendMessage({ chatId: conn.telegramChatId, text: rendered.body, parseMode: "HTML" });
      return NextResponse.json({ ok: true, channel, status: "SENT" });
    }

    if (channel === "IN_APP") {
      if (!isScenarioKey(key)) {
        return NextResponse.json(
          { error: "IN_APP тест доступен только для сценариев нового пайплайна" },
          { status: 400 },
        );
      }
      const type = resolveNotificationTypeForScenario(key);
      await prisma.notification.create({
        data: {
          userId: auth.id,
          type,
          scenario: key,
          title: rendered.subject ?? "Тестовое уведомление",
          body: rendered.body,
          audience: "USER",
        },
      });
      return NextResponse.json({ ok: true, channel, status: "SENT" });
    }

    return NextResponse.json({ error: "Неизвестный канал" }, { status: 400 });
  } catch (error) {
    console.error("[admin templates test] delivery failed", { key, channel, error });
    return NextResponse.json({ error: "Не удалось отправить тест" }, { status: 500 });
  }
}
