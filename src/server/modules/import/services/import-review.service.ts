/**
 * ImportReviewService — Phase 2C
 * Decision persistence без publish/apply в Place.
 */

import prisma from "@/lib/prisma";
import type { ImportReviewTask, ImportReviewTaskStatus } from "@prisma/client";
import type { ReviewDecisionPayload } from "../types";
import * as repo from "../repositories/import-review-task.repository";

export async function getPendingTasks(params?: {
  limit?: number;
  offset?: number;
}): Promise<ImportReviewTask[]> {
  return repo.findImportReviewTasksByStatus("PENDING", params);
}

export async function getTaskById(id: string): Promise<ImportReviewTask | null> {
  return repo.findImportReviewTaskById(id);
}

export async function getTaskByRecordId(recordId: string): Promise<ImportReviewTask | null> {
  return repo.findImportReviewTaskByRecordId(recordId);
}

export async function countPendingTasks(): Promise<number> {
  return repo.countPendingImportReviewTasks();
}

export async function updateTaskStatus(
  id: string,
  status: ImportReviewTaskStatus,
): Promise<ImportReviewTask> {
  return repo.updateImportReviewTask(id, { status });
}

/**
 * Сохранить решение ревьюера.
 *
 * Обновляет:
 *   - ImportReviewTask: status, decision, reviewerUserId, reviewedAt, notes
 *   - ImportedRecord: reviewStatus, reviewDecision (JSON)
 *
 * НЕ создаёт и НЕ изменяет Place.
 */
export async function applyDecision(
  taskId: string,
  payload: ReviewDecisionPayload,
): Promise<ImportReviewTask> {
  const task = await prisma.importReviewTask.findUnique({
    where: { id: taskId },
    include: { importedRecord: { select: { id: true } } },
  });

  if (!task) throw new Error(`ImportReviewTask not found: ${taskId}`);
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    throw new Error(`Task ${taskId} is already ${task.status}`);
  }

  const isApproved = payload.decision !== "REJECTED" && payload.decision !== "DEFERRED";
  const taskStatus: ImportReviewTaskStatus = isApproved ? "COMPLETED" : "COMPLETED";
  const reviewStatus = payload.decision === "REJECTED" ? "REJECTED" : "APPROVED";

  // Маппинг decision → ImportDecision enum
  const decisionMap: Record<ReviewDecisionPayload["decision"], string> = {
    APPROVED_CREATE:  "APPROVED_CREATE",
    APPROVED_UPDATE:  "APPROVED_UPDATE",
    APPROVED_MERGE:   "APPROVED_MERGE",
    REJECTED:         "REJECTED",
    DEFERRED:         "DEFERRED",
  };

  const [updatedTask] = await prisma.$transaction([
    prisma.importReviewTask.update({
      where: { id: taskId },
      data: {
        status: taskStatus,
        decision: decisionMap[payload.decision] as never,
        reviewerUserId: payload.reviewerUserId,
        reviewedAt: new Date(payload.reviewedAt),
        notes: payload.notes ?? null,
      },
    }),
    prisma.importedRecord.update({
      where: { id: task.importedRecord.id },
      data: {
        reviewStatus: reviewStatus as never,
        reviewDecision: payload as object,
      },
    }),
  ]);

  return updatedTask;
}
