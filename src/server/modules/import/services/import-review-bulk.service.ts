/**
 * Пакетные действия очереди ревью: «Опубликовать» и «Отклонить».
 *
 * «Опубликовать» применимо только к событиям, где ревью-задача рекомендует
 * CREATE_NEW и у записи заполнены обязательные поля. Всё, где нужен взгляд
 * редактора (конфликт текста и афиши, возможный дубль, изменение источника,
 * не CREATE_NEW), пропускается с причиной. Публикация создаёт событие со
 * статусом PENDING, как и одиночное действие. Записи обрабатываются по одной,
 * ошибка одной не останавливает остальные.
 */

import type { ImportReviewTaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { mapNormalizedToActivity } from "../publish/event-field-mapper";
import { asTelegramFlags } from "../normalizers/telegram-post.mapper";
import type { NormalizedEventImport, ReviewDecisionPayload } from "../types";
import { applyDecision } from "./import-review.service";
import { publishApprovedEventRecord } from "./import-publish.service";

/** За один вызов; больше не берём, чтобы запрос не висел минутами. */
export const BULK_REVIEW_MAX = 50;

export type BulkSkipReason =
  | "not_found"
  | "not_event"
  | "already_linked"
  | "already_decided"
  | "no_open_task"
  | "not_create_new"
  | "not_matched"
  | "incomplete"
  | "has_conflict"
  | "has_duplicates"
  | "source_changed";

export const BULK_SKIP_LABEL: Record<BulkSkipReason, string> = {
  not_found: "запись не найдена",
  not_event: "не событие",
  already_linked: "уже связана с каталогом",
  already_decided: "решение уже принято",
  no_open_task: "нет открытой задачи ревью",
  not_create_new: "не «создать новое»: нужен взгляд редактора",
  not_matched: "проверка дублей не завершена",
  incomplete: "нет названия, даты или места",
  has_conflict: "текст и афиша расходятся",
  has_duplicates: "есть возможный дубль",
  source_changed: "пост изменился",
};

export interface BulkItemResult {
  importedRecordId: string;
  title: string | null;
  outcome: "published" | "rejected" | "skipped" | "failed";
  /** Причина пропуска (`BulkSkipReason`) или текст ошибки публикации. */
  reason?: string;
  activityId?: string;
}

export interface BulkCandidate {
  entityTypeHint: string | null;
  publishedActivityId: string | null;
  publishedPlaceId: string | null;
  reviewStatus: string;
  /** Итог матчинга: только `NO_MATCH` значит «дублей среди каталога не найдено». */
  matchStatus: string | null;
  normalizedData: unknown;
  qualityFlags: unknown;
  task: { id: string; status: ImportReviewTaskStatus; suggestedAction: string | null } | null;
}

const OPEN_TASK: ImportReviewTaskStatus[] = ["PENDING", "IN_PROGRESS"];

function hasRequiredEventFields(nd: NormalizedEventImport | null): boolean {
  if (!nd?.title?.trim()) return false;
  const hasDate = Boolean(nd.startAt) || (nd.occurrences ?? []).some((o) => Boolean(o.startAt));
  const hasPlace = Boolean(nd.venueName?.trim() || nd.addressText?.trim());
  return hasDate && hasPlace;
}

/** Можно ли опубликовать запись в пакетном режиме. Чистая функция. */
export function checkBulkPublishEligibility(
  record: BulkCandidate,
): { ok: true } | { ok: false; reason: BulkSkipReason } {
  if (record.entityTypeHint !== "EVENT") return { ok: false, reason: "not_event" };
  if (record.publishedActivityId || record.publishedPlaceId) return { ok: false, reason: "already_linked" };
  if (record.reviewStatus !== "PENDING" && record.reviewStatus !== "IN_REVIEW") {
    return { ok: false, reason: "already_decided" };
  }
  if (!record.task || !OPEN_TASK.includes(record.task.status)) return { ok: false, reason: "no_open_task" };
  if (record.task.suggestedAction !== "CREATE_NEW") return { ok: false, reason: "not_create_new" };
  // Запасная рекомендация после сбоя матчинга тоже CREATE_NEW (matchStatus SKIPPED/PENDING):
  // дубли не проверялись, такую запись публикует только редактор вручную.
  if (record.matchStatus !== "NO_MATCH") return { ok: false, reason: "not_matched" };

  const nd = record.normalizedData as NormalizedEventImport | null;
  if (!hasRequiredEventFields(nd)) return { ok: false, reason: "incomplete" };

  const flags = asTelegramFlags(record.qualityFlags);
  if (flags?.hasConflict) return { ok: false, reason: "has_conflict" };
  if ((flags?.pendingDuplicates?.length ?? 0) > 0) return { ok: false, reason: "has_duplicates" };
  if (flags?.sourceChanged) return { ok: false, reason: "source_changed" };
  return { ok: true };
}

/** Можно ли отклонить запись в пакетном режиме. */
export function checkBulkRejectEligibility(
  record: BulkCandidate,
): { ok: true } | { ok: false; reason: BulkSkipReason } {
  if (record.publishedActivityId || record.publishedPlaceId) return { ok: false, reason: "already_linked" };
  if (record.reviewStatus !== "PENDING" && record.reviewStatus !== "IN_REVIEW") {
    return { ok: false, reason: "already_decided" };
  }
  if (!record.task || !OPEN_TASK.includes(record.task.status)) return { ok: false, reason: "no_open_task" };
  return { ok: true };
}

export interface BulkDeps {
  applyDecision: typeof applyDecision;
  publish: typeof publishApprovedEventRecord;
  /** Пробная сборка полей события: ловит нехватку обязательных данных до решения. */
  validateMapping: (nd: NormalizedEventImport) => Promise<string | null>;
  now: () => Date;
}

const defaultDeps: BulkDeps = {
  applyDecision,
  publish: publishApprovedEventRecord,
  validateMapping: async (nd) => {
    const mapped = await mapNormalizedToActivity(nd, null);
    return "error" in mapped ? mapped.error : null;
  },
  now: () => new Date(),
};

async function loadCandidates(ids: string[]) {
  const unique = [...new Set(ids)];
  const rows = await prisma.importedRecord.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      entityTypeHint: true,
      publishedActivityId: true,
      publishedPlaceId: true,
      reviewStatus: true,
      matchStatus: true,
      normalizedData: true,
      qualityFlags: true,
      reviewTask: { select: { id: true, status: true, suggestedAction: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return unique.map((id) => ({ id, row: byId.get(id) ?? null }));
}

function titleOf(normalizedData: unknown): string | null {
  const title = (normalizedData as { title?: unknown } | null)?.title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

function assertBatchSize(ids: string[]) {
  if (ids.length === 0) throw new Error("Не выбрано ни одной записи");
  if (new Set(ids).size > BULK_REVIEW_MAX) {
    throw new Error(`За один раз можно обработать не больше ${BULK_REVIEW_MAX} записей`);
  }
}

export async function bulkPublishCreateNew(
  importedRecordIds: string[],
  reviewerUserId: string,
  deps: BulkDeps = defaultDeps,
): Promise<BulkItemResult[]> {
  assertBatchSize(importedRecordIds);
  const results: BulkItemResult[] = [];

  for (const { id, row } of await loadCandidates(importedRecordIds)) {
    if (!row) {
      results.push({ importedRecordId: id, title: null, outcome: "skipped", reason: "not_found" });
      continue;
    }
    const title = titleOf(row.normalizedData);
    const verdict = checkBulkPublishEligibility({ ...row, task: row.reviewTask });
    if (!verdict.ok) {
      results.push({ importedRecordId: id, title, outcome: "skipped", reason: verdict.reason });
      continue;
    }

    try {
      // До решения проверяем, что событие вообще соберётся: иначе запись осталась бы одобренной, но не созданной.
      const mappingError = await deps.validateMapping(row.normalizedData as unknown as NormalizedEventImport);
      if (mappingError) {
        results.push({ importedRecordId: id, title, outcome: "failed", reason: mappingError });
        continue;
      }
      await deps.applyDecision(row.reviewTask!.id, {
        decision: "APPROVED_CREATE",
        targetEntityId: null,
        targetEntityType: null,
        selectedCandidateId: null,
        notes: "bulk publish",
        reviewerUserId,
        reviewedAt: deps.now().toISOString(),
      } satisfies ReviewDecisionPayload);

      const published = await deps.publish(id, reviewerUserId);
      if (!published.success) {
        const reason = "reason" in published ? published.reason : "Не удалось применить импорт";
        results.push({ importedRecordId: id, title, outcome: "failed", reason });
        continue;
      }
      results.push({ importedRecordId: id, title, outcome: "published", activityId: published.placeId });
    } catch (error) {
      results.push({
        importedRecordId: id,
        title,
        outcome: "failed",
        reason: error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    }
  }
  return results;
}

export async function bulkRejectRecords(
  importedRecordIds: string[],
  reviewerUserId: string,
  deps: Pick<BulkDeps, "applyDecision" | "now"> = defaultDeps,
): Promise<BulkItemResult[]> {
  assertBatchSize(importedRecordIds);
  const results: BulkItemResult[] = [];

  for (const { id, row } of await loadCandidates(importedRecordIds)) {
    if (!row) {
      results.push({ importedRecordId: id, title: null, outcome: "skipped", reason: "not_found" });
      continue;
    }
    const title = titleOf(row.normalizedData);
    const verdict = checkBulkRejectEligibility({ ...row, task: row.reviewTask });
    if (!verdict.ok) {
      results.push({ importedRecordId: id, title, outcome: "skipped", reason: verdict.reason });
      continue;
    }
    try {
      await deps.applyDecision(row.reviewTask!.id, {
        decision: "REJECTED",
        targetEntityId: null,
        targetEntityType: null,
        selectedCandidateId: null,
        notes: "bulk reject",
        reviewerUserId,
        reviewedAt: deps.now().toISOString(),
      } satisfies ReviewDecisionPayload);
      results.push({ importedRecordId: id, title, outcome: "rejected" });
    } catch (error) {
      results.push({
        importedRecordId: id,
        title,
        outcome: "failed",
        reason: error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    }
  }
  return results;
}

/** Короткое резюме для тоста: «Опубликовано 3, пропущено 2 (…)». */
export function summarizeBulkResults(results: BulkItemResult[]): string {
  const count = (outcome: BulkItemResult["outcome"]) => results.filter((r) => r.outcome === outcome).length;
  const parts: string[] = [];
  if (count("published")) parts.push(`опубликовано ${count("published")}`);
  if (count("rejected")) parts.push(`отклонено ${count("rejected")}`);
  const skipped = results.filter((r) => r.outcome === "skipped");
  if (skipped.length > 0) {
    const reasons = [...new Set(skipped.map((r) => BULK_SKIP_LABEL[r.reason as BulkSkipReason] ?? r.reason))];
    parts.push(`пропущено ${skipped.length} (${reasons.join("; ")})`);
  }
  if (count("failed")) parts.push(`ошибок ${count("failed")}`);
  const text = parts.join(", ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Ничего не изменено";
}
