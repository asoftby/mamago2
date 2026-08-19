"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DirectMessageHiddenReason } from "@prisma/client";

const HIDDEN_REASON_LABELS: Record<DirectMessageHiddenReason, string> = {
  SPAM: "Спам",
  ABUSE: "Оскорбления",
  SCAM: "Мошенничество",
  OFFTOPIC: "Не по теме",
  OTHER: "Другое",
};

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Request failed");
  }
  return res.json();
}

export function BlockUnblockButtons({ threadId, isBlocked }: { threadId: string; isBlocked: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const action = isBlocked ? "unblock" : "block";
  const label = isBlocked ? "Разблокировать диалог" : "Заблокировать диалог";

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await postJson(`/api/admin/direct/dialogs/${threadId}/${action}`);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ошибка");
            }
          });
        }}
        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
          isBlocked
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-red-600 text-white hover:bg-red-700"
        } disabled:opacity-50`}
      >
        {label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SystemMessageForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setError(null);
        startTransition(async () => {
          try {
            await postJson(`/api/admin/direct/dialogs/${threadId}/system-message`, { body });
            setBody("");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка");
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Системное сообщение от имени mamaGo…"
        rows={2}
        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          Отправить системное сообщение
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </form>
  );
}

export function CompleteOccasionButton({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await postJson(`/api/admin/direct/occasions/${threadId}/complete`);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ошибка");
            }
          });
        }}
        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-200"
      >
        Завершить повод
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function HideMessageButton({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-stone-400 underline underline-offset-2 hover:text-stone-700"
      >
        Скрыть
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {(Object.keys(HIDDEN_REASON_LABELS) as DirectMessageHiddenReason[]).map((reason) => (
        <button
          key={reason}
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await postJson(`/api/admin/direct/messages/${messageId}/hide`, { reason });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка");
              }
            });
          }}
          className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-200"
        >
          {HIDDEN_REASON_LABELS[reason]}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="text-xs text-stone-400">
        отмена
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
