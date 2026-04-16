/**
 * ImportMatchingService — entity-level matching для PLACE и EVENT.
 *
 * Инвариант: ImportReviewTask уже существует к моменту matching (создана при ingest).
 * Здесь только обновляются кандидаты, matchStatus на ImportedRecord и рекомендации в ImportReviewTask.
 */

import prisma from "@/lib/prisma";
import type {
  NormalizedPlaceImport,
  NormalizedEventImport,
  PlaceMatchResult,
  EventMatchResult,
  ReviewTaskCreationResult,
} from "../types";
import { findPlaceCandidates } from "../matching/place-candidate-search";
import { scorePlaceCandidate } from "../matching/place-match-scorer";
import { determineSuggestedAction } from "../matching/suggested-action";
import { findEventCandidates } from "../matching/event-candidate-search";
import { scoreEventCandidate } from "../matching/event-match-scorer";
import { determineEventSuggestedAction } from "../matching/event-suggested-action";
import {
  FALLBACK_PRIORITY_AFTER_MATCH_ERROR,
  FALLBACK_SUGGESTED_AFTER_MATCH_ERROR,
  ensureMissingReviewTasksForRun,
  setReviewTaskRecommendation,
  setReviewTaskRecommendationSafe,
} from "./import-review-task.service";

export { ensureMissingReviewTasksForRun, repairMissingImportReviewTask } from "./import-review-task.service";

const MIN_PLACE_CANDIDATE_SCORE = 0.15;
const MIN_EVENT_CANDIDATE_SCORE = 0.2;
const MAX_CANDIDATES = 5;

export interface MatchRecordResult {
  recordId: string;
  success: boolean;
  entityType?: "PLACE" | "EVENT";
  matchResult?: PlaceMatchResult | EventMatchResult;
  /** Итог работы с ImportReviewTask (рекомендации обновлены или fallback) */
  reviewTask?: ReviewTaskCreationResult;
  error?: string;
}

export interface MatchRunRecordsResult {
  results: MatchRecordResult[];
  /** Задачи, созданные только safeguard'ом (сироты без задачи — прежде всего legacy) */
  orphanTasksCreated: number;
}

/**
 * Запустить matching для одной ImportedRecord.
 * Маршрутизирует по entityTypeHint.
 */
export async function matchRecord(recordId: string): Promise<MatchRecordResult> {
  const record = await prisma.importedRecord.findUnique({ where: { id: recordId } });

  if (!record) return { recordId, success: false, error: "Record not found" };
  if (record.normalizeStatus !== "SUCCESS" || !record.normalizedData) {
    return { recordId, success: false, error: "Record not normalized yet" };
  }

  if (record.entityTypeHint === "PLACE") return matchPlaceRecord(record);
  if (record.entityTypeHint === "EVENT") return matchEventRecord(record);

  return { recordId, success: false, error: `Unsupported entityType: ${record.entityTypeHint}` };
}

// ── PLACE matching ────────────────────────────────────────────────────────────

async function matchPlaceRecord(
  record: { id: string; normalizedData: unknown; qualityScore: number | null },
): Promise<MatchRecordResult> {
  try {
    const normalized = record.normalizedData as unknown as NormalizedPlaceImport;
    const rawCandidates = await findPlaceCandidates(normalized);

    const scored = rawCandidates
      .map((c) => scorePlaceCandidate(normalized, c))
      .filter((c) => c.score >= MIN_PLACE_CANDIDATE_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES);

    const qualityScore = record.qualityScore ?? 0;
    const actionResult = determineSuggestedAction(scored, qualityScore);

    const matchResult: PlaceMatchResult = {
      recordId: record.id,
      candidates: scored,
      topCandidate: scored[0] ?? null,
      matchStatus: actionResult.matchStatus,
      suggestedAction: actionResult.suggestedAction,
      confidenceScore: actionResult.confidenceScore,
    };

    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        matchCandidates: scored as unknown as object[],
        confidenceScore: actionResult.confidenceScore,
        matchStatus: actionResult.matchStatus === "FAILED" ? "SKIPPED" : actionResult.matchStatus,
      },
    });

    const reviewTask = await setReviewTaskRecommendation(
      record.id,
      actionResult.suggestedAction,
      actionResult.reviewPriority,
    );

    return { recordId: record.id, success: true, entityType: "PLACE", matchResult, reviewTask };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: { matchStatus: "SKIPPED", errorMessage: message },
    });
    const reviewTask = await setReviewTaskRecommendationSafe(
      record.id,
      FALLBACK_SUGGESTED_AFTER_MATCH_ERROR,
      FALLBACK_PRIORITY_AFTER_MATCH_ERROR,
      `place-match-fallback: ${message}`,
    );
    return {
      recordId: record.id,
      success: false,
      entityType: "PLACE",
      error: message,
      reviewTask,
    };
  }
}

// ── EVENT matching ────────────────────────────────────────────────────────────

async function matchEventRecord(
  record: { id: string; normalizedData: unknown; qualityScore: number | null },
): Promise<MatchRecordResult> {
  try {
    const normalized = record.normalizedData as unknown as NormalizedEventImport;
    const rawCandidates = await findEventCandidates(normalized);

    const scored = rawCandidates
      .map((c) => scoreEventCandidate(normalized, c))
      .filter((c) => c.score >= MIN_EVENT_CANDIDATE_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES);

    const qualityScore = record.qualityScore ?? 0;
    const actionResult = determineEventSuggestedAction(scored, qualityScore);

    const matchResult: EventMatchResult = {
      recordId: record.id,
      candidates: scored,
      topCandidate: scored[0] ?? null,
      matchStatus: actionResult.matchStatus,
      suggestedAction: actionResult.suggestedAction,
      confidenceScore: actionResult.confidenceScore,
    };

    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        matchCandidates: scored as unknown as object[],
        confidenceScore: actionResult.confidenceScore,
        matchStatus: actionResult.matchStatus === "FAILED" ? "SKIPPED" : actionResult.matchStatus,
      },
    });

    const reviewTask = await setReviewTaskRecommendation(
      record.id,
      actionResult.suggestedAction,
      actionResult.reviewPriority,
    );

    return { recordId: record.id, success: true, entityType: "EVENT", matchResult, reviewTask };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: { matchStatus: "SKIPPED", errorMessage: message },
    });
    const reviewTask = await setReviewTaskRecommendationSafe(
      record.id,
      FALLBACK_SUGGESTED_AFTER_MATCH_ERROR,
      FALLBACK_PRIORITY_AFTER_MATCH_ERROR,
      `event-match-fallback: ${message}`,
    );
    return {
      recordId: record.id,
      success: false,
      entityType: "EVENT",
      error: message,
      reviewTask,
    };
  }
}

// ── Batch ─────────────────────────────────────────────────────────────────────

/**
 * Matching для всех нормализованных PLACE/EVENT с matchStatus PENDING,
 * плюс safeguard: любые сироты без ImportReviewTask в этом run.
 */
export async function matchRunRecords(runId: string): Promise<MatchRunRecordsResult> {
  const pre = await ensureMissingReviewTasksForRun(runId);

  const records = await prisma.importedRecord.findMany({
    where: {
      runId,
      normalizeStatus: "SUCCESS",
      matchStatus: "PENDING",
      entityTypeHint: { in: ["PLACE", "EVENT"] },
    },
    select: { id: true },
  });

  const results: MatchRecordResult[] = [];
  for (const { id } of records) {
    results.push(await matchRecord(id));
  }

  const post = await ensureMissingReviewTasksForRun(runId);

  return { results, orphanTasksCreated: pre.created + post.created };
}
