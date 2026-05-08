"use client";

import { useEffect, useState } from "react";
import { Laptop, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmailTemplateDocument } from "@/features/email-studio/lib";

const PREVIEW_PRESET_OPTIONS = [
  { value: "new-user", label: "Новый пользователь" },
  { value: "user-with-child", label: "Пользователь с ребёнком" },
  { value: "plan-reminder", label: "Напоминание о плане" },
  { value: "empty-state", label: "Пустое состояние" },
] as const;

type PreviewPreset = (typeof PREVIEW_PRESET_OPTIONS)[number]["value"];
type PreviewFrame = "desktop" | "mobile";

type PreviewResponse = {
  subject: string;
  preheader: string;
  html: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message || data.error || "Preview failed";
  } catch {
    return "Preview failed";
  }
}

export function EmailTemplatePreviewPanel({
  subject,
  preheader,
  document,
  previewPreset,
  onPreviewPresetChange,
}: {
  subject: string;
  preheader: string;
  document: EmailTemplateDocument;
  previewPreset: PreviewPreset;
  onPreviewPresetChange: (value: PreviewPreset) => void;
}) {
  const [frame, setFrame] = useState<PreviewFrame>("desktop");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rendered, setRendered] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let requestStarted = false;
    const timeoutId = window.setTimeout(async () => {
      requestStarted = true;
      setState("loading");
      setError(null);

      try {
        const response = await fetch("/api/admin/email-templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            preheader: preheader || null,
            document,
            previewPreset,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const data = (await response.json()) as PreviewResponse;
        setRendered(data);
        setState("ready");
      } catch (previewError) {
        if (controller.signal.aborted) return;
        setRendered(null);
        setState("error");
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Не удалось построить preview.",
        );
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      if (requestStarted && !controller.signal.aborted) {
        controller.abort(new DOMException("Preview request superseded.", "AbortError"));
      }
    };
  }, [document, preheader, previewPreset, subject]);

  const frameClassName =
    frame === "mobile"
      ? "mx-auto w-[320px]"
      : "w-full";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Предпросмотр</CardTitle>
        <CardDescription>
          Реальный рендер письма из общего Email Studio pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Сценарий preview</Label>
          <Select value={previewPreset} onValueChange={onPreviewPresetChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREVIEW_PRESET_OPTIONS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={frame === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => setFrame("desktop")}
          >
            <Laptop className="size-4" />
            Десктоп
          </Button>
          <Button
            type="button"
            variant={frame === "mobile" ? "default" : "outline"}
            size="sm"
            onClick={() => setFrame("mobile")}
          >
            <Smartphone className="size-4" />
            Мобильный
          </Button>
        </div>

        {state === "loading" && rendered ? (
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Обновляем preview…
          </div>
        ) : null}

        {state === "error" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || "Не удалось построить preview."}
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Тема письма</div>
              <div className="text-sm font-medium">
                {rendered?.subject || (state === "loading" ? "Собираем…" : "Тема не задана")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Прехедер</div>
              <div className="text-sm text-muted-foreground">
                {rendered?.preheader || (state === "loading" ? "Собираем…" : "Не задан")}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-3">
          {state === "loading" && !rendered ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Собираем preview…
            </div>
          ) : null}

          {state !== "loading" && rendered ? (
            <div className={frameClassName}>
              <iframe
                title="Email preview"
                srcDoc={rendered.html}
                className="min-h-[640px] w-full rounded-xl border border-border bg-white"
                sandbox=""
              />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
