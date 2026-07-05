import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  NOTIFICATION_SCENARIOS,
  type NotificationScenario,
  type SendNotificationContext,
} from "@/lib/notifications/domainContracts";
import { sendNotification } from "@/server/notifications/notification.service";

export const runtime = "nodejs";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

type RouteParams = Promise<{ key: string }>;

function isScenarioKey(key: string): key is NotificationScenario {
  return Object.values(NOTIFICATION_SCENARIOS).includes(key as NotificationScenario);
}

/**
 * Синтетический контекст для тестовой отправки самому себе.
 * planItemId/digestDate получают префикс test: и timestamp, чтобы
 * dedupe-ключ теста никогда не блокировал реальные отправки
 * (у реального дайджеста eventId — это дата YYYY-MM-DD).
 */
function buildTestContext(scenario: NotificationScenario): SendNotificationContext {
  const stamp = Date.now();

  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return {
        planItemId: `test:${stamp}`,
        activityId: null,
        eventTitle: "Тестовое событие mamaGo",
        startsAt: new Date(stamp + 2 * 60 * 60 * 1000),
        placeName: "Тестовая площадка",
        cityName: null,
      };
    case "PLAN_TOMORROW_DIGEST": {
      const tomorrowMorning = new Date(stamp + 24 * 60 * 60 * 1000);
      return {
        digestDate: `test:${stamp}`,
        planItemIds: [],
        items: [
          {
            planItemId: `test:${stamp}:1`,
            eventTitle: "Тестовое событие mamaGo",
            startsAt: tomorrowMorning,
            placeName: "Тестовая площадка",
          },
        ],
      };
    }
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}

export async function POST(
  _req: Request,
  { params }: { params: RouteParams },
) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const limit = await checkRateLimit(`admin-scenario-test:${auth.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подожди минуту и повтори." },
      { status: 429 },
    );
  }

  const { key } = await params;
  if (!isScenarioKey(key)) {
    return NextResponse.json(
      { error: "Тестовая отправка доступна только для сценариев нового пайплайна" },
      { status: 400 },
    );
  }

  try {
    const result = await sendNotification({
      scenario: key,
      userId: auth.id,
      context: buildTestContext(key),
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      ...(result.status === "SKIPPED" ? { reason: result.reason } : {}),
      deliveries: result.deliveries.map((delivery) => ({
        channel: delivery.channel,
        status: delivery.status,
        errorMessage: delivery.errorMessage ?? null,
      })),
    });
  } catch (error) {
    console.error("[admin communications scenarios] test send failed", error);
    return NextResponse.json({ error: "Не удалось отправить тестовое уведомление" }, { status: 500 });
  }
}
