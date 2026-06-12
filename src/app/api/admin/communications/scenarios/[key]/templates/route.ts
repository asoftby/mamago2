import { NextResponse } from "next/server";
import type { NotificationChannel } from "@prisma/client";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { prisma } from "@/lib/prisma";
import { validateTemplateForScenario } from "@/server/notifications/template-render.service";

export const runtime = "nodejs";

type RouteParams = Promise<{ key: string }>;

const ALLOWED_CHANNELS = new Set<NotificationChannel>(["IN_APP", "EMAIL", "TELEGRAM"]);

function parseChannel(value: unknown): NotificationChannel | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase() as NotificationChannel;
  return ALLOWED_CHANNELS.has(upper) ? upper : null;
}

/**
 * POST /api/admin/communications/scenarios/[key]/templates
 * Body: { channel: "IN_APP"|"EMAIL"|"TELEGRAM", subject?: string|null, body: string }
 *
 * Upserts a template override. Admin-only.
 * Validates all {{vars}} before writing.
 */
export async function POST(req: Request, { params }: { params: RouteParams }) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const { key } = await params;
  const body = (await req.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const { channel: rawChannel, subject: rawSubject, body: rawBody } = body as Record<string, unknown>;

  const channel = parseChannel(rawChannel);
  if (!channel) {
    return NextResponse.json(
      { error: "channel должен быть IN_APP, EMAIL или TELEGRAM" },
      { status: 400 },
    );
  }

  if (typeof rawBody !== "string" || rawBody.trim() === "") {
    return NextResponse.json({ error: "body обязателен" }, { status: 400 });
  }

  const subject = rawSubject === null || rawSubject === undefined ? null : String(rawSubject);

  const validation = validateTemplateForScenario({
    scenarioKey: key,
    subject,
    body: rawBody,
  });

  if (!validation.ok) {
    if (validation.error === "UNKNOWN_SCENARIO") {
      return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Шаблон содержит неизвестные переменные",
        unknownVariables: validation.unknownVariables,
        availableVariables: validation.availableVariables,
      },
      { status: 422 },
    );
  }

  const template = await prisma.notificationTemplate.upsert({
    where: { scenarioKey_channel: { scenarioKey: key, channel } },
    create: {
      scenarioKey: key,
      channel,
      subject,
      body: rawBody,
      updatedByUserId: auth.id,
    },
    update: {
      subject,
      body: rawBody,
      updatedByUserId: auth.id,
    },
    select: {
      id: true,
      scenarioKey: true,
      channel: true,
      subject: true,
      body: true,
      updatedAt: true,
      updatedByUser: { select: { email: true } },
    },
  });

  return NextResponse.json({ ok: true, template });
}

/**
 * DELETE /api/admin/communications/scenarios/[key]/templates?channel=EMAIL
 *
 * Removes template override, reverting to code default. Admin-only.
 */
export async function DELETE(req: Request, { params }: { params: RouteParams }) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const { key } = await params;
  const { searchParams } = new URL(req.url);
  const channel = parseChannel(searchParams.get("channel"));

  if (!channel) {
    return NextResponse.json(
      { error: "channel обязателен (IN_APP, EMAIL или TELEGRAM)" },
      { status: 400 },
    );
  }

  await prisma.notificationTemplate.deleteMany({
    where: { scenarioKey: key, channel },
  });

  return NextResponse.json({ ok: true });
}
