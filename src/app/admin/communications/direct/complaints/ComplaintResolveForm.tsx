"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DirectComplaintStatus } from "@prisma/client";

const RESOLVE_OPTIONS: { value: DirectComplaintStatus; label: string }[] = [
  { value: DirectComplaintStatus.REVIEWED, label: "Рассмотрена" },
  { value: DirectComplaintStatus.DISMISSED, label: "Отклонена" },
  { value: DirectComplaintStatus.ACTION_TAKEN, label: "Приняты меры" },
];

export function ComplaintResolveForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DirectComplaintStatus>(DirectComplaintStatus.REVIEWED);
  const [resolution, setResolution] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-stone-700"
      >
        Разобрать
      </button>
    );
  }

  return (
    <div className="flex min-w-[280px] flex-col gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as DirectComplaintStatus)}
        className="rounded-lg border border-stone-200 px-2 py-1 text-xs"
      >
        {RESOLVE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <textarea
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="Что было сделано / почему такое решение…"
        rows={2}
        className="rounded-lg border border-stone-200 px-2 py-1 text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          disabled={isPending || !resolution.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const res = await fetch(`/api/admin/direct/complaints/${complaintId}/resolve`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status, resolution }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error ?? "Ошибка");
                }
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка");
              }
            });
          }}
          className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          Сохранить
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-stone-400">
          отмена
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
