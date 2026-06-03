"use client";

import { useState } from "react";
import { Loader2, RefreshCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function AdminNotificationTestButtons() {
  const [emailPending, setEmailPending] = useState(false);
  const [telegramPending, setTelegramPending] = useState(false);

  const handleTest = async (
    kind: "email" | "telegram",
    setPending: (value: boolean) => void,
  ) => {
    setPending(true);
    try {
      const res = await fetch(`/api/notifications/${kind}/test`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            code?: string;
            messageId?: string | null;
            actualTo?: string;
          }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.code || "TEST_FAILED");
      }
      toast.success(
        kind === "email"
          ? json?.messageId
            ? `Тестовое письмо отправлено: ${json.messageId}`
            : `Тестовое письмо отправлено на ${json?.actualTo ?? "указанный адрес"}`
          : "Тест в Telegram отправлен",
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "TEST_FAILED";
      toast.error(
        kind === "email"
          ? `Email test не удался: ${code}`
          : `Telegram test не удался: ${code}`,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={() => void handleTest("email", setEmailPending)}
        disabled={emailPending}
      >
        {emailPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Test email
      </Button>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={() => void handleTest("telegram", setTelegramPending)}
        disabled={telegramPending}
      >
        {telegramPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Test Telegram
      </Button>
    </div>
  );
}

export function ResendDeliveryButton({ deliveryId }: { deliveryId: string }) {
  const [pending, setPending] = useState(false);

  const handleResend = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/notifications/deliveries/${deliveryId}/resend`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) {
        throw new Error("RESEND_FAILED");
      }
      toast.success("Повторная отправка выполнена");
      window.location.reload();
    } catch {
      toast.error("Не удалось повторно отправить delivery");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 rounded-lg px-2 text-xs"
      onClick={() => void handleResend()}
      disabled={pending}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
      Resend
    </Button>
  );
}
