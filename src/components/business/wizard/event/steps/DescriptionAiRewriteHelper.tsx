"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  extractPlainTextFromHtml,
  plainTextToRichTextHtml,
} from "@/lib/richtext/utils";

type RewriteTone = "neutral" | "friendly" | "editorial" | "short";

const TONE_OPTIONS: Array<{ value: RewriteTone; label: string }> = [
  { value: "neutral", label: "Нейтрально" },
  { value: "friendly", label: "Дружелюбно" },
  { value: "editorial", label: "Афишно" },
  { value: "short", label: "Кратко" },
];

interface DescriptionAiRewriteHelperProps {
  title?: string;
  value: string;
  isEditable: boolean;
  onApply: (html: string) => void;
}

export function DescriptionAiRewriteHelper({
  title,
  value,
  isEditable,
  onApply,
}: DescriptionAiRewriteHelperProps) {
  const [tone, setTone] = useState<RewriteTone>("neutral");
  const [isLoading, setIsLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string>("");
  const [previewTone, setPreviewTone] = useState<RewriteTone | null>(null);

  const sourceText = useMemo(() => extractPlainTextFromHtml(value), [value]);
  const canRewrite = isEditable && sourceText.trim().length >= 20;

  const runRewrite = async () => {
    if (!canRewrite) {
      toast.message("Сначала добавьте исходное описание хотя бы на 20 символов");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          sourceText,
          title,
          entityType: "event",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Не удалось переписать текст");
      }

      setPreviewText(payload.result);
      setPreviewTone(tone);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось переписать текст");
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreview = () => {
    if (!previewText.trim()) return;
    onApply(plainTextToRichTextHtml(previewText));
    toast.success("AI-вариант применён");
    setPreviewText("");
    setPreviewTone(null);
  };

  const resetPreview = () => {
    setPreviewText("");
    setPreviewTone(null);
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-stone-700" />
            <p className="text-sm font-medium text-stone-900">AI-помощник</p>
          </div>
          <p className="text-[12px] text-stone-600">
            Переписывает существующий текст без автозамены. Сначала показывает вариант, потом вы решаете, применять ли его.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={tone === option.value ? "default" : "outline"}
              className={cn("h-8 rounded-full px-3", tone === option.value ? "" : "bg-white")}
              disabled={!isEditable || isLoading}
              onClick={() => setTone(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={!canRewrite || isLoading} onClick={() => void runRewrite()}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Переписать
        </Button>
        {!canRewrite ? (
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
                Тон: {TONE_OPTIONS.find((option) => option.value === previewTone)?.label ?? "Нейтрально"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyPreview}>
                Применить
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => void runRewrite()}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Попробовать ещё раз
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetPreview}>
                Отмена
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-800 whitespace-pre-wrap">
            {previewText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
