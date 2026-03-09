/**
 * Summary component showing overview of changes
 */

import { DiffSummary as DiffSummaryType } from "@/lib/moderation/diffUtils";
import { FileEdit, ImagePlus, ImageMinus } from "lucide-react";

interface DiffSummaryProps {
  summary: DiffSummaryType;
}

export function DiffSummary({ summary }: DiffSummaryProps) {
  if (summary.totalChanges === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">Нет изменений</p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-blue-900 mb-3">Сводка изменений</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summary.changedFields > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <FileEdit className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Изменено полей</p>
              <p className="text-lg font-bold text-blue-900">{summary.changedFields}</p>
            </div>
          </div>
        )}

        {summary.addedPhotos > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <ImagePlus className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">Добавлено фото</p>
              <p className="text-lg font-bold text-green-900">{summary.addedPhotos}</p>
            </div>
          </div>
        )}

        {summary.removedPhotos > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <ImageMinus className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-red-600 font-medium">Удалено фото</p>
              <p className="text-lg font-bold text-red-900">{summary.removedPhotos}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
