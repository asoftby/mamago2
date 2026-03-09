"use client";

import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface MicroEdit {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  editType: string;
  comment: string | null;
  createdAt: string;
  moderator: {
    email: string;
  };
}

interface MicroEditHistoryProps {
  edits: MicroEdit[];
}

const EDIT_TYPE_LABELS: Record<string, string> = {
  TYPO: "Опечатка",
  PUNCTUATION: "Пунктуация",
  FORMATTING: "Форматирование",
  CAPITALIZATION: "Заглавные буквы",
  PHONE_NORMALIZATION: "Нормализация телефона",
  LINK_NORMALIZATION: "Нормализация ссылки",
  WHITESPACE_CLEANUP: "Пробелы",
  OTHER: "Другое",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Название",
  shortDesc: "Краткое описание",
  description: "Полное описание",
  phone: "Телефон",
  website: "Веб-сайт",
  instagramHandle: "Instagram",
  instagramUrl: "Instagram URL",
  customAddress: "Дополнительный адрес",
};

export function MicroEditHistory({ edits }: MicroEditHistoryProps) {
  if (edits.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        Редакторских правок пока не было
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {edits.map((edit) => (
        <div key={edit.id} className="border rounded-lg p-3 bg-gray-50">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {FIELD_LABELS[edit.fieldName] || edit.fieldName}
              </span>
              <Badge variant="outline" className="text-xs">
                {EDIT_TYPE_LABELS[edit.editType] || edit.editType}
              </Badge>
            </div>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(edit.createdAt), {
                addSuffix: true,
                locale: ru,
              })}
            </span>
          </div>

          <div className="space-y-1 text-sm">
            {edit.oldValue && (
              <div className="text-gray-600">
                <span className="text-xs text-gray-500">Было:</span>{" "}
                <span className="line-through">{edit.oldValue}</span>
              </div>
            )}
            {edit.newValue && (
              <div className="text-gray-900">
                <span className="text-xs text-gray-500">Стало:</span>{" "}
                <span className="font-medium">{edit.newValue}</span>
              </div>
            )}
          </div>

          {edit.comment && (
            <div className="mt-2 text-xs text-gray-600 italic">
              {edit.comment}
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500">
            Модератор: {edit.moderator.email}
          </div>
        </div>
      ))}
    </div>
  );
}
