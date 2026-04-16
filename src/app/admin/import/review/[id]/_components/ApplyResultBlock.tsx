
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { ImportApplyResultPayload } from "@/server/modules/import/types";

interface Props {
  applyResult: ImportApplyResultPayload;
  entityType: "PLACE" | "EVENT";
}

export function ApplyResultBlock({ applyResult, entityType }: Props) {
  const entityId = applyResult.placeId;
  const entityLabel = entityType === "EVENT" ? "ID события" : "ID места";
  const borderClass = entityType === "EVENT" ? "border-violet-200 bg-violet-50" : "border-green-200 bg-green-50";
  const headerClass = entityType === "EVENT" ? "bg-violet-100 border-violet-200 text-violet-900" : "bg-green-100 border-green-200 text-green-900";

  return (
    <div className={`rounded-lg border overflow-hidden ${borderClass}`}>
      <div className={`px-4 py-3 border-b ${headerClass}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide">Результат публикации</h2>
        <p className="text-xs mt-0.5 opacity-70">
          Применено {format(new Date(applyResult.appliedAt), "dd MMM yyyy HH:mm", { locale: ru })}
        </p>
      </div>

      <div className="p-4 space-y-2 text-sm">
        {/* Entity ID */}
        {entityId && (
          <div className="flex gap-3">
            <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">{entityLabel}</span>
            <span className="font-mono text-xs text-gray-900 break-all">{entityId}</span>
          </div>
        )}

        {/* Decision */}
        <div className="flex gap-3">
          <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">Решение</span>
          <span className="text-xs font-medium text-gray-900">{applyResult.decision}</span>
        </div>

        {/* Applied fields */}
        {applyResult.appliedFields.length > 0 && (
          <div className="flex gap-3">
            <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">Обновили поля</span>
            <div className="flex flex-wrap gap-1">
              {applyResult.appliedFields.map((f) => (
                <span key={f} className="rounded bg-green-100 text-green-800 px-1.5 py-0.5 text-xs">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Skipped fields */}
        {applyResult.skippedFields.length > 0 && (
          <div className="flex gap-3">
            <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">Не перезаписывали</span>
            <div className="flex flex-wrap gap-1">
              {applyResult.skippedFields.map((f) => (
                <span key={f} className="rounded bg-yellow-100 text-yellow-800 px-1.5 py-0.5 text-xs">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Empty fields */}
        {applyResult.emptyFields.length > 0 && (
          <div className="flex gap-3">
            <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">Пусто или не сопоставлено</span>
            <div className="flex flex-wrap gap-1">
              {applyResult.emptyFields.map((f) => (
                <span key={f} className="rounded bg-gray-100 text-gray-500 px-1.5 py-0.5 text-xs">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {applyResult.warnings && applyResult.warnings.length > 0 && (
          <div className="flex gap-3">
            <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">Предупреждения</span>
            <ul className="text-xs text-yellow-700 space-y-0.5">
              {applyResult.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          </div>
        )}

        {/* Note */}
        {applyResult.note && (
          <div className="flex gap-3">
            <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">Комментарий</span>
            <span className="text-xs text-gray-600 italic">{applyResult.note}</span>
          </div>
        )}

        {/* Actor */}
        <div className="flex gap-3 pt-1 border-t border-gray-200 mt-2">
          <span className="text-xs text-gray-400 w-36 shrink-0">Кто применил</span>
          <span className="text-xs text-gray-500 font-mono">{applyResult.appliedByUserId}</span>
        </div>
      </div>
    </div>
  );
}
