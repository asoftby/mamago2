/**
 * Суточная сводка по Telegram-каналам для админов (в приложении и в Telegram
 * через общий реестр уведомлений).
 *
 *   «Каналы за сутки: 14 новых, 6 возможных дублей, 3 изменения в
 *    опубликованных. Ждёт решения: 23. Модель: 48 вызовов, 52 тыс. токенов.»
 *
 * Отправляется один раз в сутки по Минску, не раньше 09:00, и только если
 * есть что сказать. Идемпотентна: повторный вызов в тот же день ничего не шлёт.
 * Заодно это отчёт о расходе модели по источникам.
 */

import prisma from "@/lib/prisma";
import { asTelegramFlags } from "../normalizers/telegram-post.mapper";

export const DIGEST_HOUR_MINSK = 9;
const MINSK_OFFSET_MS = 3 * 60 * 60 * 1000; // Минск без перехода на летнее время
const MAX_SOURCES_IN_TEXT = 5;
const RECORD_SCAN_LIMIT = 5000;

export interface SourceDigest {
  sourceId: string;
  name: string;
  newRecords: number;
  waiting: number;
  aiCalls: number;
  tokens: number;
}

export interface ChannelsDigestStats {
  windowHours: number;
  sources: number;
  newRecords: number;
  possibleDuplicates: number;
  changedPublished: number;
  waiting: number;
  aiCalls: number;
  tokensIn: number;
  tokensOut: number;
  bySource: SourceDigest[];
}

/** Календарная дата по Минску, YYYY-MM-DD. */
export function minskDateKey(now: Date): string {
  return new Date(now.getTime() + MINSK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Пора ли слать: по Минску уже 09:00 или позже. */
export function isDigestDue(now: Date): boolean {
  return new Date(now.getTime() + MINSK_OFFSET_MS).getUTCHours() >= DIGEST_HOUR_MINSK;
}

function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${Math.round(tokens / 1000)} тыс.` : String(tokens);
}

export async function collectChannelsDigest(now: Date, windowHours = 24): Promise<ChannelsDigestStats> {
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const sources = await prisma.importSource.findMany({
    where: { type: "TELEGRAM_CHANNEL", archivedAt: null },
    select: { id: true, name: true },
  });
  const ids = sources.map((s) => s.id);
  const empty: ChannelsDigestStats = {
    windowHours, sources: sources.length, newRecords: 0, possibleDuplicates: 0, changedPublished: 0,
    waiting: 0, aiCalls: 0, tokensIn: 0, tokensOut: 0, bySource: [],
  };
  if (ids.length === 0) return empty;

  const [records, tasks, runs] = await Promise.all([
    prisma.importedRecord.findMany({
      where: { sourceId: { in: ids }, entityTypeHint: "EVENT", OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }] },
      select: { sourceId: true, createdAt: true, normalizeStatus: true, matchStatus: true, publishedActivityId: true, qualityFlags: true },
      take: RECORD_SCAN_LIMIT,
    }),
    prisma.importReviewTask.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] }, importedRecord: { sourceId: { in: ids }, normalizeStatus: "SUCCESS" } },
      select: { importedRecord: { select: { sourceId: true } } },
    }),
    prisma.importRun.groupBy({
      by: ["sourceId"],
      where: { sourceId: { in: ids }, startedAt: { gte: since } },
      _sum: { aiCalls: true, aiTokensIn: true, aiTokensOut: true },
    }),
  ]);

  const per = new Map<string, SourceDigest>(
    sources.map((s) => [s.id, { sourceId: s.id, name: s.name, newRecords: 0, waiting: 0, aiCalls: 0, tokens: 0 }]),
  );

  let newRecords = 0;
  let possibleDuplicates = 0;
  let changedPublished = 0;
  for (const record of records) {
    const flags = asTelegramFlags(record.qualityFlags);
    const detectedAt = flags?.sourceChanged ? new Date(flags.sourceChanged.detectedAt) : null;
    if (record.publishedActivityId && detectedAt && detectedAt >= since) changedPublished++;

    if (record.createdAt >= since && record.normalizeStatus === "SUCCESS") {
      newRecords++;
      per.get(record.sourceId)!.newRecords++;
      if ((flags?.pendingDuplicates?.length ?? 0) > 0 || record.matchStatus === "AMBIGUOUS") possibleDuplicates++;
    }
  }
  for (const task of tasks) per.get(task.importedRecord.sourceId)!.waiting++;

  let aiCalls = 0, tokensIn = 0, tokensOut = 0;
  for (const run of runs) {
    const calls = run._sum.aiCalls ?? 0;
    const tin = run._sum.aiTokensIn ?? 0;
    const tout = run._sum.aiTokensOut ?? 0;
    aiCalls += calls; tokensIn += tin; tokensOut += tout;
    const entry = per.get(run.sourceId);
    if (entry) { entry.aiCalls += calls; entry.tokens += tin + tout; }
  }

  return {
    windowHours, sources: sources.length, newRecords, possibleDuplicates, changedPublished,
    waiting: tasks.length, aiCalls, tokensIn, tokensOut, bySource: [...per.values()],
  };
}

/** Текст сводки; null, если сказать нечего. */
export function formatChannelsDigest(stats: ChannelsDigestStats): { title: string; body: string } | null {
  if (stats.sources === 0) return null;
  const quiet = stats.newRecords === 0 && stats.changedPublished === 0 && stats.waiting === 0 && stats.aiCalls === 0;
  if (quiet) return null;

  const lines = [
    `За сутки: ${stats.newRecords} ${plural(stats.newRecords, "новый пост", "новых поста", "новых постов")}, ` +
      `${stats.possibleDuplicates} ${plural(stats.possibleDuplicates, "возможный дубль", "возможных дубля", "возможных дублей")}, ` +
      `${stats.changedPublished} ${plural(stats.changedPublished, "изменение", "изменения", "изменений")} в опубликованных. ` +
      `Ждёт решения: ${stats.waiting}.`,
  ];
  if (stats.aiCalls > 0) {
    lines.push(`Модель: ${stats.aiCalls} ${plural(stats.aiCalls, "вызов", "вызова", "вызовов")}, ${formatTokens(stats.tokensIn + stats.tokensOut)} токенов.`);
  }
  const active = stats.bySource
    .filter((s) => s.newRecords > 0 || s.waiting > 0 || s.aiCalls > 0)
    .sort((a, b) => b.waiting + b.newRecords - (a.waiting + a.newRecords))
    .slice(0, MAX_SOURCES_IN_TEXT);
  for (const s of active) {
    lines.push(`• ${s.name}: ${s.newRecords} новых, ждёт ${s.waiting}${s.aiCalls ? `, ${s.aiCalls} выз., ${formatTokens(s.tokens)} ток.` : ""}`);
  }
  return { title: "Каналы: сводка за сутки", body: lines.join("\n") };
}

export interface DigestDeps {
  listAdminIds: () => Promise<string[]>;
  alreadySent: (userId: string, entityId: string) => Promise<boolean>;
  createNotification: (params: {
    userId: string;
    audience: "ADMIN";
    type: "IMPORT_CHANNELS_DIGEST";
    title: string;
    body: string;
    entityType: "SYSTEM";
    entityId: string;
    ctaLabel: string;
    actionMode: "PAGE";
    actionUrl: string;
  }) => Promise<unknown>;
}

async function defaultDeps(): Promise<DigestDeps> {
  const { createNotification } = await import("@/server/services/notification.service");
  return {
    listAdminIds: async () =>
      (await prisma.user.findMany({ where: { role: "ADMIN", deletedAt: null }, select: { id: true } })).map((u) => u.id),
    alreadySent: async (userId, entityId) =>
      Boolean(
        await prisma.notification.findFirst({
          where: { userId, type: "IMPORT_CHANNELS_DIGEST", entityType: "SYSTEM", entityId },
          select: { id: true },
        }),
      ),
    createNotification,
  };
}

export type DigestRunResult =
  | { sent: number; skipped: null }
  | { sent: 0; skipped: "not_due" | "nothing_to_say" | "no_admins" };

export async function runChannelsDigest(now: Date = new Date(), deps?: DigestDeps): Promise<DigestRunResult> {
  if (!isDigestDue(now)) return { sent: 0, skipped: "not_due" };

  const message = formatChannelsDigest(await collectChannelsDigest(now));
  if (!message) return { sent: 0, skipped: "nothing_to_say" };

  const d = deps ?? (await defaultDeps());
  const adminIds = await d.listAdminIds();
  if (adminIds.length === 0) return { sent: 0, skipped: "no_admins" };

  const entityId = `import-channels-digest:${minskDateKey(now)}`;
  let sent = 0;
  for (const userId of adminIds) {
    if (await d.alreadySent(userId, entityId)) continue;
    await d.createNotification({
      userId,
      audience: "ADMIN",
      type: "IMPORT_CHANNELS_DIGEST",
      title: message.title,
      body: message.body,
      entityType: "SYSTEM",
      entityId,
      ctaLabel: "Открыть очередь",
      actionMode: "PAGE",
      actionUrl: "/admin/import/review",
    });
    sent++;
  }
  return { sent, skipped: null };
}
