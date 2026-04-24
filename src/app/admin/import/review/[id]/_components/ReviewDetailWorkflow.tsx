"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  EventMatchCandidate,
  ImportApplyResultPayload,
  NormalizedEventImport,
  PlaceMatchCandidate,
  ReviewDecisionPayload,
} from "@/server/modules/import/types";
import { ReviewDecisionPanel } from "./ReviewDecisionPanel";
import { ApplyPanel } from "./ApplyPanel";
import { EventApplyPanel } from "./EventApplyPanel";
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
  matchStatus: string | null;
  qualityScore: number | null;
  confidenceScore: number | null;
  normalizedEventData: Pick<NormalizedEventImport, "typeCandidate" | "scheduleModeCandidate" | "venueName"> | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 min-w-0 break-words">{value}</span>
    </div>
  );
}

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_NEW: "bg-blue-100 text-blue-800",
  UPDATE_EXISTING: "bg-yellow-100 text-yellow-800",
  MERGE: "bg-purple-100 text-purple-800",
  REJECT: "bg-red-100 text-red-800",
};
const MATCH_COLORS: Record<string, string> = {
  NO_MATCH: "bg-blue-50 text-blue-700",
  MATCHED: "bg-green-100 text-green-800",
  AMBIGUOUS: "bg-yellow-100 text-yellow-800",
  FAILED: "bg-red-100 text-red-800",
  PENDING: "bg-gray-100 text-gray-600",
};
const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};
const DECISION_COLORS: Record<string, string> = {
  APPROVED_CREATE: "bg-blue-100 text-blue-800",
  APPROVED_UPDATE: "bg-yellow-100 text-yellow-800",
  APPROVED_MERGE: "bg-purple-100 text-purple-800",
  REJECTED: "bg-red-100 text-red-800",
  DEFERRED: "bg-gray-100 text-gray-600",
};

export function ReviewDetailWorkflow({
  task: initialTask,
  importedRecord: initialImportedRecord,
  entityType,
  applyActorLabel,
  candidates,
  matchStatus,
  qualityScore,
  confidenceScore,
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

  const reviewedAtLabel = useMemo(() => {
    if (!task?.reviewedAt) return null;
    return format(new Date(task.reviewedAt), "dd MMM yyyy HH:mm", { locale: ru });
  }, [task?.reviewedAt]);

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

      <Section title="Review meta">
        <Field
          label="Entity type"
          value={
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                isEventRecord ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
              }`}
            >
              {entityType}
            </span>
          }
        />
        <Field
          label="Suggested action"
          value={task?.suggestedAction ? <Badge value={task.suggestedAction} colorMap={ACTION_COLORS} /> : null}
        />
        <Field
          label="Match status"
          value={matchStatus ? <Badge value={matchStatus} colorMap={MATCH_COLORS} /> : null}
        />
        <Field
          label="Task status"
          value={
            task ? (
              <Badge value={task.status} colorMap={TASK_STATUS_COLORS} />
            ) : (
              <span className="text-rose-700 font-medium">Нет задачи (ошибка пайплайна)</span>
            )
          }
        />
        <Field
          label="Decision"
          value={task?.decision ? <Badge value={task.decision} colorMap={DECISION_COLORS} /> : null}
        />
        <Field
          label="Review status"
          value={
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                importedRecord.reviewStatus === "APPROVED"
                  ? "bg-green-100 text-green-800"
                  : importedRecord.reviewStatus === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {importedRecord.reviewStatus}
            </span>
          }
        />
        <Field
          label="Stage"
          value={
            isAlreadyApplied ? (
              <span className="text-sm font-medium text-green-700">Опубликовано в каталог</span>
            ) : isApproved ? (
              <span className="text-sm font-medium text-blue-700">Решение сохранено, готово к публикации</span>
            ) : isResolved ? (
              <span className="text-sm font-medium text-gray-700">Решение сохранено</span>
            ) : (
              <span className="text-sm text-gray-500">Ожидает решения</span>
            )
          }
        />
        <Field label="Quality score" value={qualityScore != null ? `${(qualityScore * 100).toFixed(0)}%` : null} />
        <Field
          label="Confidence score"
          value={confidenceScore != null ? `${(confidenceScore * 100).toFixed(0)}%` : null}
        />
        <Field label="Priority" value={task ? String(task.priority) : "—"} />
        {task?.notes && <Field label="Notes" value={task.notes} />}
        {task?.reviewerUserId && <Field label="Reviewer" value={task.reviewerUserId} />}
        {reviewedAtLabel && <Field label="Reviewed at" value={reviewedAtLabel} />}
      </Section>

      {task && !isResolved && (
        <ReviewDecisionPanel
          taskId={task.id}
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

      {isApproved && !isAlreadyApplied && isEventRecord && reviewDecision && (
        <EventApplyPanel
          importedRecordId={importedRecord.id}
          decision={reviewDecision.decision}
          targetEntityId={reviewDecision.targetEntityId}
          typeCandidate={normalizedEventData?.typeCandidate}
          scheduleModeCandidate={normalizedEventData?.scheduleModeCandidate}
          venueName={normalizedEventData?.venueName}
        />
      )}

      {importedRecord.applyResult && (
        <ApplyResultBlock
          applyResult={importedRecord.applyResult}
          entityType={isEventRecord ? "EVENT" : "PLACE"}
          appliedByLabel={applyActorLabel}
        />
      )}
    </>
  );
}
