"use client";

import { useState } from "react";
import type {
  EventMatchCandidate,
  ImportApplyResultPayload,
  NormalizedEventImport,
  PlaceMatchCandidate,
  ReviewDecisionPayload,
} from "@/server/modules/import/types";
import { ReviewDecisionPanel } from "./ReviewDecisionPanel";
import { ApplyPanel } from "./ApplyPanel";
import { EventReviewWorkflow } from "./EventReviewWorkflow";
import { ApplyResultBlock } from "./ApplyResultBlock";

type EntityType = "PLACE" | "EVENT";

type ReviewTaskState = {
  id: string;
  status: string;
  suggestedAction: string | null;
  reviewedAt: string | null;
  priority: number;
  notes: string | null;
  reviewerUserId: string | null;
  decision: string | null;
} | null;

type ImportedRecordWorkflowState = {
  id: string;
  reviewStatus: string;
  reviewDecision: ReviewDecisionPayload | null;
  publishedPlaceId: string | null;
  publishedActivityId: string | null;
  applyResult: ImportApplyResultPayload | null;
};

interface Props {
  task: ReviewTaskState;
  importedRecord: ImportedRecordWorkflowState;
  entityType: EntityType;
  applyActorLabel?: string | null;
  candidates: (PlaceMatchCandidate | EventMatchCandidate)[];
  normalizedEventData: Pick<NormalizedEventImport, "typeCandidate" | "scheduleModeCandidate" | "venueName"> | null;
}

export function ReviewDetailWorkflow({
  task: initialTask,
  importedRecord: initialImportedRecord,
  entityType,
  applyActorLabel,
  candidates,
  normalizedEventData,
}: Props) {
  const [task, setTask] = useState<ReviewTaskState>(initialTask);
  const [importedRecord, setImportedRecord] = useState<ImportedRecordWorkflowState>(initialImportedRecord);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isEventRecord = entityType === "EVENT";
  const isResolved = task ? task.status === "COMPLETED" || task.status === "CANCELLED" : false;
  const isApproved = importedRecord.reviewStatus === "APPROVED";
  const isAlreadyApplied = !!importedRecord.publishedPlaceId || !!importedRecord.publishedActivityId;
  const reviewDecision = importedRecord.reviewDecision;
  const linkRecovery = reviewDecision?.recovery ?? null;

  return (
    <>
      {savedMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          {savedMessage}
        </div>
      )}

      {linkRecovery && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Связанная сущность была удалена. Импортный объект снова доступен для обработки.
        </div>
      )}

      {task && !isResolved && !isEventRecord && (
        <ReviewDecisionPanel
          taskId={task.id}
          importedRecordId={importedRecord.id}
          isApplied={isAlreadyApplied}
          entityType={entityType}
          suggestedAction={task.suggestedAction ?? undefined}
          candidates={candidates}
          onSaved={(data) => {
            setTask(data.task);
            setImportedRecord((current) => ({
              ...current,
              reviewStatus: data.importedRecord.reviewStatus,
              reviewDecision: data.importedRecord.reviewDecision,
              publishedPlaceId: data.importedRecord.publishedPlaceId,
              publishedActivityId: data.importedRecord.publishedActivityId,
            }));
            setSavedMessage("Решение сохранено. Следующий шаг доступен сразу ниже, без перезагрузки страницы.");
          }}
        />
      )}

      {isApproved && !isAlreadyApplied && reviewDecision && !isEventRecord && (
        <ApplyPanel
          importedRecordId={importedRecord.id}
          decision={reviewDecision.decision}
          targetEntityId={reviewDecision.targetEntityId}
        />
      )}

      {isEventRecord && task && (
        <EventReviewWorkflow
          taskId={task.id}
          importedRecordId={importedRecord.id}
          suggestedAction={task.suggestedAction}
          taskStatus={task.status}
          candidates={candidates}
          venueName={normalizedEventData?.venueName}
          initialApplyResult={
            importedRecord.applyResult
              ? {
                  activityId: importedRecord.applyResult.activityId ?? null,
                  activitySlug: importedRecord.applyResult.activitySlug ?? null,
                }
              : null
          }
          initialDecision={
            reviewDecision && reviewDecision.decision !== "REJECTED" && reviewDecision.decision !== "DEFERRED"
              ? reviewDecision.decision
              : null
          }
          initialTargetEntityId={reviewDecision?.targetEntityId ?? null}
        />
      )}

      {importedRecord.applyResult && !isEventRecord && (
        <ApplyResultBlock
          applyResult={importedRecord.applyResult}
          entityType={isEventRecord ? "EVENT" : "PLACE"}
          appliedByLabel={applyActorLabel}
        />
      )}
    </>
  );
}
