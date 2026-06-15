import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { getNotificationScenarioDefinition } from "@/lib/notifications/notificationRegistry";
import {
  renderTemplateForChannelCore,
  type TemplateRenderChannel,
} from "@/server/notifications/template-render-core";

export const runtime = "nodejs";

type RouteParams = Promise<{ key: string }>;

const ALLOWED_CHANNELS = new Set<TemplateRenderChannel>(["IN_APP", "EMAIL", "TELEGRAM"]);

/**
 * POST /api/admin/communications/scenarios/[key]/templates/preview
 * Body: { channel: "IN_APP"|"EMAIL"|"TELEGRAM", subject?: string|null, body: string }
 *
 * Renders a template using the scenario's samplePayload.
 * The preview goes through the same sanitization as live sends
 * (sanitizeHtmlAllowlist for EMAIL, sanitizeTelegramHtml for TELEGRAM).
 * No DB writes. Admin-only.
 */
export async function POST(req: Request, { params }: { params: RouteParams }) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const { key } = await params;
  const body = (await req.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const { channel: rawChannel, subject: rawSubject, body: rawBody } = body as Record<
    string,
    unknown
  >;

  const channel = typeof rawChannel === "string" && ALLOWED_CHANNELS.has(rawChannel as TemplateRenderChannel)
    ? (rawChannel as TemplateRenderChannel)
    : null;

  if (!channel) {
    return NextResponse.json(
      { error: "channel должен быть IN_APP, EMAIL или TELEGRAM" },
      { status: 400 },
    );
  }

  if (typeof rawBody !== "string") {
    return NextResponse.json({ error: "body обязателен" }, { status: 400 });
  }

  const definition = getNotificationScenarioDefinition(key);
  if (!definition) {
    return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
  }

  const subject = rawSubject === null || rawSubject === undefined ? null : String(rawSubject);
  const allowedVariables = Object.keys(definition.payloadSchema.shape);

  try {
    const rendered = renderTemplateForChannelCore({
      channel,
      subjectTemplate: subject,
      bodyTemplate: rawBody,
      payload: definition.samplePayload,
      allowedVariables,
    });
    return NextResponse.json({ ok: true, rendered });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ошибка рендера шаблона",
      },
      { status: 422 },
    );
  }
}
