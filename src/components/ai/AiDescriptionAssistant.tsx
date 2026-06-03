"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractPlainTextFromHtml,
  plainTextToRichTextHtml,
} from "@/lib/richtext/utils";
import { formatDescriptionText } from "@/lib/text/formatDescription";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  AI_DESCRIPTION_ACTION_LABELS,
  type AiDescriptionAction,
  type AiDescriptionContext,
  type AiDescriptionEntityType,
} from "@/lib/ai/descriptionAssistant";

interface AiDescriptionAssistantProps {
  entityType: AiDescriptionEntityType;
  title?: string;
  value: string;
  isEditable: boolean;
  onApply: (html: string) => void;
  context?: AiDescriptionContext;
  emptyAction?: AiDescriptionAction | null;
  filledActions: AiDescriptionAction[];
  helperText?: string;
}

export function AiDescriptionAssistant({
  entityType,
  title,
  value,
  isEditable,
  onApply,
  context,
  emptyAction = "generate",
  filledActions,
  helperText = "AI предлагает вариант отдельно и не заменяет текст без вашего подтверждения.",
}: AiDescriptionAssistantProps) {
  const [selectedAction, setSelectedAction] = useState<AiDescriptionAction>(
    filledActions[0] ?? emptyAction ?? "improve",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewAction, setPreviewAction] = useState<AiDescriptionAction | null>(null);

  const sourceText = useMemo(() => extractPlainTextFromHtml(value), [value]);
  const hasSourceText = sourceText.trim().length >= 20;
  const actionToRun = hasSourceText ? selectedAction : emptyAction;
  const canRun = isEditable && Boolean(actionToRun) && (hasSourceText || emptyAction === "generate");

  const previewParagraphs = previewText
    ? previewText.split("\n\n").map((part) => part.trim()).filter(Boolean)
    : [];

  const runAssistant = async (action: AiDescriptionAction) => {
    if (!isEditable) return;
    if (action !== "generate" && !hasSourceText) {
      toast.message("Сначала добавьте исходное описание хотя бы на 20 символов");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          entityType,
          title,
          sourceText,
          context,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Не удалось сгенерировать текст. Попробуйте ещё раз.");
      }

      const formatted = formatDescriptionText(payload.result);
      setPreviewText(formatted);
      setPreviewAction(action);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось сгенерировать текст. Попробуйте ещё раз.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreview = () => {
    if (!previewText.trim()) return;
    onApply(plainTextToRichTextHtml(previewText));
    toast.success("AI-вариант применён");
    setPreviewText("");
    setPreviewAction(null);
  };

  const resetPreview = () => {
    setPreviewText("");
    setPreviewAction(null);
  };

  return (
    <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-stone-700" />
            <p className="text-sm font-medium text-stone-900">AI-помощник</p>
          </div>
          <p className="text-[12px] text-stone-600">{helperText}</p>
        </div>

        {hasSourceText ? (
          <div className="flex flex-wrap gap-2">
            {filledActions.map((action) => (
              <Button
                key={action}
                type="button"
                size="sm"
                variant={selectedAction === action ? "default" : "outline"}
                className={cn(
                  "h-8 rounded-full px-3",
                  selectedAction === action ? "" : "bg-white",
                )}
                disabled={!isEditable || isLoading}
                onClick={() => setSelectedAction(action)}
              >
                {AI_DESCRIPTION_ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canRun || isLoading || !actionToRun}
          onClick={() => actionToRun && void runAssistant(actionToRun)}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {actionToRun ? AI_DESCRIPTION_ACTION_LABELS[actionToRun] : "AI-помощник"}
        </Button>
        {!hasSourceText && emptyAction !== "generate" ? (
          <span className="text-[12px] text-stone-500">
            Нужно хотя бы 20 символов исходного текста.
          </span>
        ) : null}
      </div>

      {previewText ? (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-stone-900">Предложенный вариант</p>
              <p className="text-[12px] text-stone-500">
                Действие:{" "}
                {previewAction ? AI_DESCRIPTION_ACTION_LABELS[previewAction] : "AI-помощник"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyPreview}>
                Применить
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isLoading || !previewAction}
                onClick={() => previewAction && void runAssistant(previewAction)}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Попробовать ещё раз
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetPreview}>
                Отмена
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-3 rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-800">
            {previewParagraphs.map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
