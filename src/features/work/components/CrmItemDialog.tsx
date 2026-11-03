"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarClock, ClipboardList, MessageSquareText, X } from "lucide-react";
import type { WorkItem, WorkStatus } from "../workDashboardModel";
import { minskDateTime } from "../workDashboardModel";

type Activity = {
  id: string;
  type: string;
  body: string | null;
  createdAt: string;
  actor: { id: string; displayName: string | null };
};
type DetailedItem = WorkItem & {
  activities: Activity[];
};

interface Props {
  item: WorkItem;
  onClose: () => void;
  onSaved: () => void;
}

export function CrmItemDialog({ item, onClose, onSaved }: Props) {
  const [detail, setDetail] = useState<DetailedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<WorkStatus>(item.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/work/items/${item.id}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Не удалось открыть дело");
        return response.json() as Promise<DetailedItem>;
      })
      .then(payload => {
        if (controller.signal.aborted) return;
        setDetail(payload);
        setStatus(payload.status);
        setLoading(false);
      }).catch(cause => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [item.id]);

  async function saveStatus() {
    if (!detail || status === detail.status) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/work/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedUpdatedAt: detail.updatedAt }),
      });
      if (!response.ok) throw new Error(response.status === 409 ?
        "Дело уже изменено. Закройте карточку и откройте её снова." : "Не удалось изменить статус");
      onSaved(); onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/work/items/${item.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "NOTE", body: note.trim(), requestKey: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить запись");
      setNote("");
      const fresh = await fetch(`/api/admin/work/items/${item.id}`, { cache: "no-store" });
      if (fresh.ok) setDetail(await fresh.json() as DetailedItem);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/40 px-4 py-6"
      onKeyDown={event => { if (event.key === "Escape" && !busy) onClose(); }}>
      <div className="absolute inset-0" onClick={() => !busy && onClose()} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-labelledby="crm-detail-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">Дело</p>
            <h2 id="crm-detail-title" className="text-xl font-semibold text-gray-950">{item.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{item.business?.name ?? item.lead?.name ?? "Без клиента"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" disabled={busy}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
          {loading ? <p className="text-sm text-gray-500">Загружаем историю…</p> : (
            <>
              {detail?.dueAt && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CalendarClock className="h-4 w-4 text-gray-400" />
                  {minskDateTime(detail.dueAt, "full")} (Минск)
                </div>
              )}
              {detail?.nextAction && (
                <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  <span className="font-semibold">Следующий шаг:</span> {detail.nextAction}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium text-gray-700">
                  Статус дела
                  <select value={status} onChange={event => setStatus(event.target.value as WorkStatus)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                    <option value="NEW">Новое</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="WAITING">Ожидаем</option>
                    <option value="DONE">Выполнено</option>
                    <option value="CANCELED">Отменено</option>
                  </select>
                </label>
                <button type="button" disabled={busy || status === detail?.status} onClick={saveStatus}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                  Сохранить
                </button>
              </div>
              <div className="border-t border-gray-100 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">История работы</h3>
                </div>
                {detail?.activities.length ? (
                  <div className="space-y-3">
                    {detail.activities.map(activity => (
                      <div key={activity.id} className="border-l-2 border-emerald-100 pl-3">
                        <p className="text-xs text-gray-400">{minskDateTime(activity.createdAt, "full")} · {activity.actor.displayName || "Сотрудник"}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{activity.body || activity.type}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">История пока пуста.</p>}
              </div>
              <form onSubmit={addNote} className="space-y-2 border-t border-gray-100 pt-5">
                <label htmlFor="crm-note" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <MessageSquareText className="h-4 w-4" /> Добавить заметку
                </label>
                <textarea id="crm-note" required maxLength={4000} rows={3} value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Например, обсудили условия размещения"
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100" />
                <button type="submit" disabled={busy || !note.trim()}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50">
                  Записать
                </button>
              </form>
            </>
          )}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </div>
  );
}
