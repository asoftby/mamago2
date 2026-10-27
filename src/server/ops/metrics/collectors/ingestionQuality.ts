/**
 * telemetry.bot_rejected_share_24h / _7d, telemetry.no_identity_rejected_share_24h,
 * telemetry.stored_without_identity_share_24h — every 15 min (ТЗ «Аналитика
 * админки», A3: блок «Качество данных» на /admin).
 *
 * Отброшенные запросы в UserEvent не пишутся, поэтому их доли считаются по
 * дельтам из `ingestionCounters.ts` (MetricSample `telemetry.ingest_*_delta`):
 *
 *   bot share         = bot / (accepted + bot + no_identity) за окно
 *   no-identity share = no_identity / (accepted + bot + no_identity) за 24 ч
 *
 * Плюс доля уже записанных событий без идентичности (нет ни userId, ни
 * sessionId, ни anonymousId) среди всех UserEvent за 24 ч — так видно
 * серверные writers, которые пишут события без контекста.
 *
 * Пустой знаменатель → сэмпл не пишется (доля не определена, не 0).
 */
import { Prisma } from "@prisma/client";
import { INGESTION_DELTA_METRICS } from "@/server/services/analytics/ingestionCounters";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

async function sumDeltas(ctx: MetricCollectorContext, since: Date) {
  const rows = await ctx.prisma.metricSample.groupBy({
    by: ["metric"],
    where: {
      metric: { in: Object.values(INGESTION_DELTA_METRICS) },
      collectedAt: { gte: since, lte: ctx.now },
    },
    _sum: { value: true },
  });
  const byMetric = new Map(rows.map((r) => [r.metric, r._sum.value ?? 0]));
  const accepted = byMetric.get(INGESTION_DELTA_METRICS.accepted) ?? 0;
  const bot = byMetric.get(INGESTION_DELTA_METRICS.bot) ?? 0;
  const noIdentity = byMetric.get(INGESTION_DELTA_METRICS.no_identity) ?? 0;
  return { accepted, bot, noIdentity, total: accepted + bot + noIdentity };
}

export async function collectIngestionQuality(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const since24h = new Date(ctx.now.getTime() - DAY_MS);
  const since7d = new Date(ctx.now.getTime() - 7 * DAY_MS);

  const [day, week, storedRows] = await Promise.all([
    sumDeltas(ctx, since24h),
    sumDeltas(ctx, since7d),
    ctx.prisma.$queryRaw<{ total: bigint; without_identity: bigint }[]>(Prisma.sql`
      SELECT
        count(*)::bigint AS total,
        count(*) FILTER (
          WHERE "userId" IS NULL AND "sessionId" IS NULL AND "anonymousId" IS NULL
        )::bigint AS without_identity
      FROM "UserEvent"
      WHERE "createdAt" >= ${since24h} AND "createdAt" < ${ctx.now}
    `),
  ]);

  const samples: MetricSampleDraft[] = [];
  if (day.total > 0) {
    samples.push(
      { metric: "telemetry.bot_rejected_share_24h", value: day.bot / day.total },
      { metric: "telemetry.no_identity_rejected_share_24h", value: day.noIdentity / day.total },
    );
  }
  if (week.total > 0) {
    samples.push({ metric: "telemetry.bot_rejected_share_7d", value: week.bot / week.total });
  }
  const storedTotal = Number(storedRows[0]?.total ?? 0);
  if (storedTotal > 0) {
    samples.push({
      metric: "telemetry.stored_without_identity_share_24h",
      value: Number(storedRows[0]?.without_identity ?? 0) / storedTotal,
    });
  }
  return samples;
}

export const ingestionQualityCollector: MetricCollector = {
  name: "ingestion_quality",
  intervalSec: 900,
  timeoutMs: 15_000,
  collect: collectIngestionQuality,
};
