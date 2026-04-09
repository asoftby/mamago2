"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREVIEW_PRESET_OPTIONS = [
  { value: "new-user", label: "Новый пользователь" },
  { value: "user-with-child", label: "Пользователь с ребёнком" },
  { value: "plan-reminder", label: "Напоминание о плане" },
  { value: "empty-state", label: "Пустое состояние" },
] as const;

export type SendTestPreviewPreset = (typeof PREVIEW_PRESET_OPTIONS)[number]["value"];

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message || data.error || "Test send failed";
  } catch {
    return "Test send failed";
  }
}

export function SendTestEmailDialog({
  open,
  onOpenChange,
  templateId,
  previewPreset,
  onPreviewPresetChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  previewPreset: SendTestPreviewPreset;
  onPreviewPresetChange: (value: SendTestPreviewPreset) => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccessMessage(null);
      setSending(false);
    }
  }, [open]);

  async function handleSubmit() {
    setSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          previewPreset,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as {
        actualTo: string;
        subject: string;
        messageId: string | null;
      };

      const message = `Тестовое письмо отправлено на ${data.actualTo}.`;
      setSuccessMessage(message);
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Не удалось отправить тестовое письмо.";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Тестовая отправка</DialogTitle>
          <DialogDescription>
            Отправим тестовое письмо по последней сохраненной версии шаблона из базы через текущий
            Email Studio renderer и выбранный preview preset.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="test-email-recipient">Email получателя</Label>
            <Input
              id="test-email-recipient"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

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
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={sending || !email.trim()}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Отправить тест
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
