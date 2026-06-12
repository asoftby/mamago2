import "server-only";

import prisma from "@/lib/prisma";
import { getNotificationScenarioDefinition } from "@/lib/notifications/notificationRegistry";
import {
  renderWithFallbackCore,
  validateTemplateVariables,
  type RenderedWithSource,
  type TemplateRenderChannel,
} from "./template-render-core";

export type RenderedNotificationTemplate = RenderedWithSource;

/**
 * Единая точка рендера шаблонов уведомлений.
 *
 * Возвращает null, когда шаблонами канал не рендерится — вызывающий обязан
 * сделать fallback на текущее (кодовое) поведение. null означает:
 * - неизвестный сценарий или payload не прошёл Zod-схему (логируется);
 * - у канала нет дефолта или дефолт kind:"code" (transactional React Email)
 *   и override в БД отсутствует;
 * - упал и override, и дефолт (логируется).
 *
 * Существующая отправка при любом исходе не ломается.
 */
export async function renderNotification(
  scenarioKey: string,
  channel: TemplateRenderChannel,
  rawPayload: Record<string, unknown>,
): Promise<RenderedNotificationTemplate | null> {
  const definition = getNotificationScenarioDefinition(scenarioKey);
  if (!definition) {
    console.warn("[notifications:template] unknown scenario, fallback to code render", {
      scenarioKey,
      channel,
    });
    return null;
  }

  const parsed = definition.payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    console.warn("[notifications:template] payload failed scenario schema, fallback to code render", {
      scenarioKey,
      channel,
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.code}`),
    });
    return null;
  }

  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (typeof value === "string") payload[key] = value;
  }
  const allowedVariables = Object.keys(definition.payloadSchema.shape);

  let override: { subject: string | null; body: string } | null = null;
  try {
    override = await prisma.notificationTemplate.findUnique({
      where: { scenarioKey_channel: { scenarioKey, channel } },
      select: { subject: true, body: true },
    });
  } catch (error) {
    console.error("[notifications:template] override lookup failed, using default", {
      scenarioKey,
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return renderWithFallbackCore({
    channel,
    payload,
    allowedVariables,
    override,
    fallbackDefault: definition.defaults[channel],
    onOverrideError: (error) => {
      console.warn("[notifications:template] override render failed, falling back to default", {
        scenarioKey,
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
    },
    onDefaultError: (error) => {
      console.error("[notifications:template] default render failed, fallback to code render", {
        scenarioKey,
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
}

/**
 * Валидация шаблона при сохранении (фаза 3 — API редактора):
 * все {{...}} в subject и body должны быть переменными сценария.
 */
export function validateTemplateForScenario(args: {
  scenarioKey: string;
  subject: string | null;
  body: string;
}):
  | { ok: true }
  | { ok: false; error: "UNKNOWN_SCENARIO" }
  | { ok: false; error: "UNKNOWN_VARIABLES"; unknownVariables: string[]; availableVariables: string[] } {
  const definition = getNotificationScenarioDefinition(args.scenarioKey);
  if (!definition) return { ok: false, error: "UNKNOWN_SCENARIO" };

  const availableVariables = Object.keys(definition.payloadSchema.shape);
  const combined = `${args.subject ?? ""}\n${args.body}`;
  const result = validateTemplateVariables(combined, availableVariables);
  if (result.ok) return { ok: true };

  return {
    ok: false,
    error: "UNKNOWN_VARIABLES",
    unknownVariables: result.unknownVariables,
    availableVariables,
  };
}

/**
 * Payload generic legacy-сценария из строки Notification.
 * Для богатых сценариев (BOOKING_CREATED) notifyXxx кладёт payload
 * в Notification.metadata.templatePayload — он имеет приоритет.
 */
export function buildLegacyTemplatePayload(notification: {
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaAction: string | null;
  metadata: unknown;
}): Record<string, unknown> {
  const metadata = notification.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const candidate = (metadata as Record<string, unknown>).templatePayload;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return {
    title: notification.title,
    body: notification.body,
    ...(notification.ctaLabel ? { ctaLabel: notification.ctaLabel } : {}),
    ...(notification.ctaAction ? { ctaUrl: notification.ctaAction } : {}),
  };
}
