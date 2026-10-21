"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptBirthdayQuoteButton({
  partyId, requestId, version,
}: { partyId: string; requestId: string; version: number }) {
  const router = useRouter();
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (busy) return;
    if (!key.current) key.current = crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const result = await fetch(
        `/api/parent/parties/${encodeURIComponent(partyId)}/requests/${encodeURIComponent(requestId)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": key.current },
          body: JSON.stringify({ expectedQuoteVersion: version }),
        },
      );
      if (!result.ok) {
        const body = (await result.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Не удалось принять условия");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка соединения");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void accept()}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Сохраняем…" : "Принять условия и запросить подтверждение"}
      </button>
      <p className="text-xs text-muted-foreground">
        Это ещё не бронь. Исполнитель должен подтвердить доступность площадки.
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
