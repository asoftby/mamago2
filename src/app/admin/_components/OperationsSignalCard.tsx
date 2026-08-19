"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, AlertOctagon, Check, Clock, MoreHorizontal, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDestructiveActionDialog } from "@/components/ui/confirm-destructive-action-dialog";
import { formatOpenedAge } from "../_lib/operationsSignalPresentation";
import { SNOOZE_CHOICES, type SnoozeChoice } from "@/server/ops/signals/computeSnoozeUntil";

const SNOOZE_LABELS: Record<SnoozeChoice, string> = {
  "1h": "1 час",
  tomorrow: "До завтра",
  "24h": "24 часа",
  "7d": "7 дней",
};

export interface DisplaySignal {
  id: string;
  severity: "CRITICAL" | "WARNING";
  title: string;
  summary: string | null;
  detailsUrl: string | null;
  openedAt: Date | null;
  acknowledgedAt: Date | null;
  isNew: boolean;
  release: { buildId: string; detectedAt: Date } | null;
  /** DEV-only, GLOBAL_NOINDEX-only explanatory context — never changes severity/title/summary. */
  devContextNote: { heading: string; body: string } | null;
}

export interface OperationsSignalCardProps {
  signal: DisplaySignal;
  now: Date;
  canResolve: boolean;
}

async function postAction(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as { error?: string }).error ?? `Ошибка (${res.status})` };
  } catch {
    return { ok: false, error: "Сетевая ошибка" };
  }
}

export function OperationsSignalCard({ signal, now, canResolve }: OperationsSignalCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmResolveOpen, setConfirmResolveOpen] = useState(false);

  const isCritical = signal.severity === "CRITICAL";
  const isAcknowledged = !!signal.acknowledgedAt;

  function refresh() {
    router.refresh();
  }

  function handleAcknowledge() {
    startTransition(async () => {
      const result = await postAction(`/api/admin/ops/signals/${signal.id}/acknowledge`);
      if (result.ok) {
        toast.success("Принято в работу");
        refresh();
      } else {
        toast.error(result.error ?? "Не удалось принять сигнал");
      }
    });
  }

  function handleSnooze(choice: SnoozeChoice) {
    startTransition(async () => {
      const result = await postAction(`/api/admin/ops/signals/${signal.id}/snooze`, { choice });
      if (result.ok) {
        toast.success("Отложено");
        refresh();
      } else {
        toast.error(result.error ?? "Не удалось отложить сигнал");
      }
    });
  }

  function handleResolve() {
    setConfirmResolveOpen(false);
    startTransition(async () => {
      const result = await postAction(`/api/admin/ops/signals/${signal.id}/resolve`);
      if (result.ok) {
        toast.success("Отмечено решённым");
        refresh();
      } else {
        toast.error(result.error ?? "Не удалось отметить решённым");
      }
    });
  }

  return (
    <div
      className={`rounded-lg border p-4 ${isCritical ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {isCritical ? (
            <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <span className={isCritical ? "text-red-700" : "text-amber-700"}>
              {isCritical ? "Critical" : "Warning"}
            </span>
            {signal.isNew && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">NEW</span>
            )}
            {isAcknowledged && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 normal-case">
                Принято
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Дополнительные действия"
              disabled={isPending}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {canResolve && (
              <DropdownMenuItem onClick={() => setConfirmResolveOpen(true)}>
                Отметить решённым
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="mt-2 text-sm font-medium text-gray-900 break-words">{signal.title}</p>
      {signal.summary && <p className="mt-1 text-sm text-gray-600 break-words">{signal.summary}</p>}

      {signal.devContextNote && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5">
          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-blue-800">
            <span className="font-semibold">{signal.devContextNote.heading}.</span>{" "}
            {signal.devContextNote.body}
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {signal.openedAt && (
          <span title={signal.openedAt.toLocaleString("ru-RU")}>{formatOpenedAge(signal.openedAt, now)}</span>
        )}
        {signal.release && (
          <span>
            Рядом с релизом {signal.release.buildId} ·{" "}
            {signal.release.detectedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {signal.detailsUrl && (
          <Button asChild variant="outline" size="sm">
            <Link href={signal.detailsUrl}>Открыть раздел</Link>
          </Button>
        )}
        {!isAcknowledged && (
          <Button size="sm" onClick={handleAcknowledge} disabled={isPending}>
            <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Принять
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              <Clock className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Отложить
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SNOOZE_CHOICES.map((choice) => (
              <DropdownMenuItem key={choice} onClick={() => handleSnooze(choice)}>
                {SNOOZE_LABELS[choice]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDestructiveActionDialog
        open={confirmResolveOpen}
        onOpenChange={setConfirmResolveOpen}
        title="Отметить сигнал решённым?"
        description="Действие необратимо помечает сигнал как решённый вручную. Если проблема повторится, будет создан новый сигнал."
        confirmText="Отметить решённым"
        cancelText="Отмена"
        loading={isPending}
        onConfirm={handleResolve}
      />
    </div>
  );
}
