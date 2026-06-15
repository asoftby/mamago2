"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ScenarioEnabledToggle({
  policyId,
  initialEnabled,
}: {
  policyId: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  const handleToggle = async (next: boolean) => {
    setPending(true);
    setEnabled(next);
    try {
      const response = await fetch(
        `/api/admin/communications/notifications/policies/${policyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ enabled: next }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось обновить сценарий");
      }
      toast.success(next ? "Сценарий включён" : "Сценарий выключен");
      router.refresh();
    } catch (error) {
      setEnabled(!next);
      toast.error(error instanceof Error ? error.message : "Не удалось обновить сценарий");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Label className="text-sm text-stone-600">
        {enabled ? "Включено" : "Выключено"}
      </Label>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(checked) => void handleToggle(checked)}
      />
    </div>
  );
}

type TestSendResponse = {
  ok?: boolean;
  status?: "SENT" | "SKIPPED";
  reason?: string;
  deliveries?: Array<{ channel: string; status: string; errorMessage?: string | null }>;
  error?: string;
};

export function ScenarioTestSendButton({
  scenarioKey,
  disabled,
  disabledReason,
}: {
  scenarioKey: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSend = async () => {
    setPending(true);
    try {
      const response = await fetch(
        `/api/admin/communications/scenarios/${scenarioKey}/test`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await response.json().catch(() => ({}))) as TestSendResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Не удалось отправить тест");
      }

      if (data.status === "SKIPPED") {
        toast.info(`Отправка пропущена: ${data.reason ?? "без причины"}`);
      } else {
        const summary = (data.deliveries ?? [])
          .map((delivery) => `${delivery.channel}: ${delivery.status}`)
          .join(", ");
        toast.success(summary ? `Тест отправлен. ${summary}` : "Тест отправлен");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить тест");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        className="rounded-2xl"
        onClick={() => void handleSend()}
        disabled={disabled || pending}
      >
        <Send className="h-4 w-4" />
        {pending ? "Отправляем…" : "Тест мне"}
      </Button>
      {disabled && disabledReason ? (
        <p className="max-w-[260px] text-right text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
