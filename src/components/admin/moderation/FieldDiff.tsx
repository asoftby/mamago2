/**
 * Component to display field changes with visual diff
 */

import { FieldChange, formatValue } from "@/lib/moderation/diffUtils";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface FieldDiffProps {
  change: FieldChange;
}

export function FieldDiff({ change }: FieldDiffProps) {
  const { label, oldValue, newValue, changeType, field } = change;

  const oldDisplay = formatValue(oldValue, field);
  const newDisplay = formatValue(newValue, field);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
        {changeType === "added" && (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Добавлено
          </Badge>
        )}
        {changeType === "removed" && (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Удалено
          </Badge>
        )}
        {changeType === "changed" && (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            Изменено
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {/* Old Value */}
        {changeType !== "added" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Текущее значение</p>
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{oldDisplay}</p>
            </div>
          </div>
        )}

        {/* Arrow for changed */}
        {changeType === "changed" && (
          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* New Value */}
        {changeType !== "removed" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Новое значение</p>
            <div
              className={`border rounded px-3 py-2 ${
                changeType === "added"
                  ? "bg-green-50 border-green-200"
                  : changeType === "changed"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <p
                className={`text-sm whitespace-pre-wrap ${
                  changeType === "added"
                    ? "text-green-900 font-medium"
                    : changeType === "changed"
                    ? "text-blue-900 font-medium"
                    : "text-gray-700"
                }`}
              >
                {newDisplay}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
