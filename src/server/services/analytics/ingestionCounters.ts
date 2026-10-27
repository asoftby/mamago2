/**
 * Счётчики входа клиентской телеметрии (ТЗ «Аналитика админки», A2/A3).
 *
 * Отброшенные запросы (боты, анонимы без sessionId) в UserEvent не пишутся,
 * но их доля нужна блоку «Качество данных». Писать строку на каждый запрос —
 * удвоить стоимость ingestion (см. BACKLOG-034), поэтому счётчики копятся в
 * памяти процесса и раз в FLUSH_INTERVAL_MS сбрасываются в MetricSample
 * дельтами (несколько процессов просто дают несколько строк — коллектор
 * `ingestionQuality` суммирует их по окну). Потеря ≤ FLUSH_INTERVAL_MS
 * счётчиков при остановке процесса допустима: это доли, а не учёт.
 */
import { prisma } from "@/lib/prisma";

export type IngestionOutcome = "accepted" | "bot" | "no_identity";

export const INGESTION_DELTA_METRICS: Record<IngestionOutcome, string> = {
  accepted: "telemetry.ingest_accepted_delta",
  bot: "telemetry.ingest_bot_delta",
  no_identity: "telemetry.ingest_no_identity_delta",
};

const FLUSH_INTERVAL_MS = 60_000;

const pending: Record<IngestionOutcome, number> = { accepted: 0, bot: 0, no_identity: 0 };
let lastFlushAt = Date.now();
let flushing = false;

/** Only for tests: read and reset the in-memory buffer without writing. */
export function __drainIngestionCountersForTests(): Record<IngestionOutcome, number> {
  const snapshot = { ...pending };
  pending.accepted = 0;
  pending.bot = 0;
  pending.no_identity = 0;
  return snapshot;
}

export function recordIngestionOutcome(outcome: IngestionOutcome, now: number = Date.now()): void {
  pending[outcome] += 1;
  if (!flushing && now - lastFlushAt >= FLUSH_INTERVAL_MS) {
    void flushIngestionCounters(now);
  }
}

/** Writes non-zero deltas as MetricSample rows. Never throws. */
export async function flushIngestionCounters(now: number = Date.now()): Promise<void> {
  if (flushing) return;
  flushing = true;
  const snapshot = { ...pending };
  pending.accepted = 0;
  pending.bot = 0;
  pending.no_identity = 0;
  lastFlushAt = now;
  try {
    const data = (Object.keys(snapshot) as IngestionOutcome[])
      .filter((key) => snapshot[key] > 0)
      .map((key) => ({ metric: INGESTION_DELTA_METRICS[key], dimKey: "", value: snapshot[key] }));
    if (data.length > 0) await prisma.metricSample.createMany({ data });
  } catch (error) {
    // Put the counts back so the next flush retries them.
    for (const key of Object.keys(snapshot) as IngestionOutcome[]) pending[key] += snapshot[key];
    console.error("[product-telemetry] ingestion counters flush failed:", error);
  } finally {
    flushing = false;
  }
}
