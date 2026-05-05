"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

type AiState = "idle" | "loading" | "success" | "error";

export function WizardStep4Description({ value, onChange }: Props) {
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiMessage, setAiMessage] = useState("");

  const remaining = 500 - value.length;
  const isOverLimit = remaining < 0;

  const handleAiRewrite = () => {
    if (!value.trim()) {
      setAiState("error");
      setAiMessage("Введите текст, чтобы AI мог его улучшить");
      setTimeout(() => setAiState("idle"), 2500);
      return;
    }
    void onChange;
    setAiState("error");
    setAiMessage("AI rewrite endpoint не подключён");
    setTimeout(() => setAiState("idle"), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Описание</h2>
        <p className="text-sm text-muted-foreground">
          Расскажите подробнее о предложении — что получит клиент
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="wiz-desc">
            Описание <span className="text-red-500">*</span>
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAiRewrite}
            disabled={aiState === "loading"}
            className={cn(
              "gap-1.5 text-xs h-7 px-2.5",
              aiState === "success" && "border-emerald-300 text-emerald-700",
              aiState === "error" && "border-red-300 text-red-600",
            )}
          >
            {aiState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : aiState === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : aiState === "error" ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiState === "loading"
              ? "Улучшаем…"
              : aiState === "success"
              ? "Готово"
              : aiState === "error"
              ? "Ошибка"
              : "AI rewrite"}
          </Button>
        </div>

        <Textarea
          id="wiz-desc"
          placeholder="Опишите кратко суть предложения, что получит клиент, для кого подходит…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className={cn(
            "resize-none transition-colors",
            isOverLimit && "border-red-400 focus-visible:ring-red-400/30",
            aiState === "loading" && "opacity-60",
          )}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-h-[1.25rem]">
            {aiState === "success" && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {aiMessage}
              </span>
            )}
            {aiState === "error" && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                {aiMessage}
              </span>
            )}
          </div>
          <p
            className={cn(
              "text-xs tabular-nums",
              isOverLimit ? "text-red-500 font-medium" : "text-muted-foreground",
            )}
          >
            {remaining} символов осталось
          </p>
        </div>
      </div>

      {/* Formatting tips */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
        <p className="text-xs font-medium text-gray-700">Советы по описанию</p>
        <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
          <li>Укажите для кого подходит предложение (возраст, уровень)</li>
          <li>Опишите что получит клиент в результате</li>
          <li>Избегайте длинных предложений — разбивайте на абзацы</li>
        </ul>
      </div>
    </div>
  );
}
