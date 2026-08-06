import { prisma } from "@/lib/prisma";
import type { AuthActor } from "@/lib/auth/safeUser";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

/**
 * Audit finding (2026-08): RankingSettings.* and BoostSettings.* are saved via
 * this route but not read by any production ranking/scoring code (confirmed
 * by exhaustive grep across src/). Mutating them is a no-op that misleads
 * admins into thinking they affect ranking. Locked read-only pending the
 * Ranking redesign. Do not re-enable without first wiring these fields into
 * an actual scoring path.
 *
 * Auth resolution (cookies() via next/headers) cannot run outside a real
 * Next.js request scope, so the route.ts wrapper resolves `actor` via
 * requireAdmin() and passes it in here — this module is the testable core,
 * exercised directly by adminRankingHandlers.test.ts against a real DB.
 */

const DEFAULT_INTENTS = [
  { intent: "today",        title: "Сегодня",       order: 0, allowedTypes: ["events"] },
  { intent: "tomorrow",     title: "Завтра",        order: 1, allowedTypes: ["events"] },
  { intent: "weekend",      title: "Выходные",      order: 2, allowedTypes: ["events"] },
  { intent: "breaking_news", title: "Breaking news", order: 3, allowedTypes: ["articles"] },
  { intent: "free",         title: "Бесплатно",      order: 4, allowedTypes: ["events"] },
];
const ACTIVE_STORY_INTENTS = DEFAULT_INTENTS.map((item) => item.intent);

export function isRankingAdmin(actor: AuthActor | null): actor is AuthActor {
  return !!actor && (actor.role === "ADMIN" || actor.role === "MODERATOR");
}

export type HandlerResult = {
  status: number;
  body: unknown;
  /** Route wrapper only calls revalidateTag() when this is true — keeps the
   * Next.js cache API (which also requires request scope) out of this
   * testable core. */
  invalidateCache?: boolean;
};

export async function handleRankingGet(actor: AuthActor | null): Promise<HandlerResult> {
  if (!isRankingAdmin(actor)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  for (const def of DEFAULT_INTENTS) {
    await prisma.storyIntentConfig.upsert({
      where: { intent: def.intent },
      create: { ...def, itemLimit: 5, enabled: true },
      update: {},
    });
  }
  await prisma.storyIntentConfig.updateMany({
    where: { intent: { notIn: ACTIVE_STORY_INTENTS }, enabled: true },
    data: { enabled: false },
  });

  const [intents, ranking, boost] = await Promise.all([
    prisma.storyIntentConfig.findMany({ where: { intent: { in: ACTIVE_STORY_INTENTS } }, orderBy: { order: "asc" } }),
    prisma.rankingSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
    prisma.boostSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
  ]);

  return { status: 200, body: { intents, ranking, boost } };
}

export async function handleRankingPost(
  actor: AuthActor | null,
  type: "ranking" | "boost" | "intent" | undefined,
  data: Record<string, unknown> | undefined,
): Promise<HandlerResult> {
  if (!isRankingAdmin(actor)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (type === "ranking" || type === "boost") {
    return {
      status: 403,
      body: {
        error:
          "Эти настройки не влияют на production ranking (подтверждено аудитом) и временно доступны только для чтения до завершения редизайна Ranking.",
      },
    };
  }

  if (type === "intent") {
    const { id, updatedAt, ...rest } = (data ?? {}) as { id: string; updatedAt: string; [k: string]: unknown };
    const before = await prisma.storyIntentConfig.findUnique({ where: { id } });
    if (!before) {
      return { status: 404, body: { error: "Not found" } };
    }
    if (!updatedAt || new Date(updatedAt).getTime() !== before.updatedAt.getTime()) {
      return {
        status: 409,
        body: { error: "Настройка была изменена другим администратором. Обновите страницу и повторите." },
      };
    }
    const updated = await prisma.storyIntentConfig.update({
      where: { id },
      data: rest,
    });
    await logAdminAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "STORY_INTENT_CONFIG_UPDATE",
      entityType: "STORY_INTENT_CONFIG",
      entityId: id,
      before: { title: before.title, enabled: before.enabled, order: before.order },
      after: { title: updated.title, enabled: updated.enabled, order: updated.order },
    });
    return { status: 200, body: updated, invalidateCache: true };
  }

  return { status: 400, body: { error: "Unknown type" } };
}
