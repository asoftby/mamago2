/**
 * Pending Record Candidates
 *
 * Дубли среди ещё не разобранных записей ДРУГИХ источников: пост канала и
 * запись ABWS о том же событии оба ждут ревью, а в `Activity` его ещё нет.
 * Результат только рекомендация; ничего не сливается автоматически.
 *
 * Оценка использует тот же скорер, что и для Activity: запись приводится к
 * `ActivityCandidate`. Выборка ограничена свежими записями, без full-scan.
 */

import prisma from "@/lib/prisma";
import type { EventMatchCandidate, NormalizedEventImport } from "../types";
import { scoreEventCandidate } from "./event-match-scorer";
import type { ActivityCandidate } from "./event-candidate-search";
import { collectImportDates } from "./event-candidate-search";
import { normalizeEventTitle, tokenJaccard } from "../utils/string-normalize";

const PENDING_FETCH_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TITLE_SIMILARITY = 0.5;
const MIN_PENDING_SCORE = 0.4;
const MAX_PENDING_RESULTS = 5;

export type PendingRecordDuplicate = Omit<EventMatchCandidate, "entityType"> & {
  entityType: "IMPORTED_RECORD";
  sourceId: string;
};

function toCandidate(recordId: string, normalized: NormalizedEventImport): ActivityCandidate {
  return {
    id: recordId,
    title: normalized.title ?? "",
    shortDesc: normalized.organizerName ?? "",
    type: "EVENT",
    scheduleMode: "MULTI_DATE",
    status: "PENDING",
    nextOccurrenceAt: null,
    cityId: null,
    placeId: null,
    venueTitle: normalized.venueName ?? null,
    venueAddress: normalized.addressText ?? null,
    sessionStarts: collectImportDates(normalized),
  };
}

function sameWindow(a: Date[], b: Date[]): boolean {
  return a.some((x) => b.some((y) => Math.abs(x.getTime() - y.getTime()) <= DAY_MS));
}

export async function findPendingRecordDuplicates(input: {
  recordId: string;
  sourceId: string;
  normalized: NormalizedEventImport;
}): Promise<PendingRecordDuplicate[]> {
  const { normalized } = input;
  const dates = collectImportDates(normalized);
  if (!normalized.title || dates.length === 0) return [];
  const importTitle = normalizeEventTitle(normalized.title);

  const rows = await prisma.importedRecord.findMany({
    where: {
      sourceId: { not: input.sourceId },
      entityTypeHint: "EVENT",
      normalizeStatus: "SUCCESS",
      reviewStatus: { in: ["PENDING", "IN_REVIEW"] },
      publishedActivityId: null,
    },
    select: { id: true, sourceId: true, normalizedData: true },
    orderBy: { createdAt: "desc" },
    take: PENDING_FETCH_LIMIT,
  });

  const results: PendingRecordDuplicate[] = [];
  for (const row of rows) {
    const other = row.normalizedData as unknown as NormalizedEventImport | null;
    if (!other?.title) continue;
    const otherDates = collectImportDates(other);
    if (!sameWindow(dates, otherDates)) continue;
    if (tokenJaccard(importTitle, normalizeEventTitle(other.title)) < MIN_TITLE_SIMILARITY) continue;

    const scored = scoreEventCandidate(normalized, toCandidate(row.id, other));
    if (scored.score < MIN_PENDING_SCORE) continue;
    results.push({ ...scored, entityType: "IMPORTED_RECORD", sourceId: row.sourceId });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, MAX_PENDING_RESULTS);
}
