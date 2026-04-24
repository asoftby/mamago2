"use client";

import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { getRichTextLength } from "@/lib/richtext/utils";
import type { EventFormData } from "../types";
import { DescriptionAiRewriteHelper } from "./DescriptionAiRewriteHelper";

interface Step2DescriptionProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

export function Step2Description({ data, onChange, isEditable }: Step2DescriptionProps) {
  const fullDescLength = getRichTextLength(data.fullDescription);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Описание</h2>
        <p className="text-[12px] text-muted-foreground">
          Расскажите подробнее о событии
        </p>
      </div>

      {/* Full Description with Rich Text Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Подробное описание <span className="text-red-500">*</span>
          </span>
          <span className="text-[12px] text-muted-foreground">
            {fullDescLength} символов
          </span>
        </div>
        <DescriptionAiRewriteHelper
          title={data.title}
          value={data.fullDescription}
          isEditable={isEditable}
          onApply={(html) => onChange({ fullDescription: html })}
        />
        <RichTextEditor
          value={data.fullDescription}
          onChange={(html) => onChange({ fullDescription: html })}
          placeholder="Расскажите о программе события, что ждет участников..."
          disabled={!isEditable}
        />
        <p className="text-[12px] text-muted-foreground">
          Минимум 20 символов. Используйте форматирование для лучшей читаемости. Краткое описание
          для карточки события и модерации формируется автоматически из этого текста (и названия),
          отдельное поле не нужно.
        </p>
      </div>
    </div>
  );
}
