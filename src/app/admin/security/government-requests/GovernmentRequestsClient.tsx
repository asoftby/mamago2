"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GovernmentCaseStatus } from "@/server/compliance/governmentRequests.policy";

type CaseSummary = {
  id: string;
  authorityName: string;
  incomingNumber: string;
  receivedAt: string;
  createdAt: string;
  status: GovernmentCaseStatus;
};

type CaseDetail = CaseSummary & {
  legalBasis: string;
  requestedScope: string;
  subjectUserId: string | null;
  resolutionNote: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<GovernmentCaseStatus, string> = {
  RECEIVED: "Получен",
  IN_REVIEW: "На проверке",
  REJECTED: "Отклонён",
  CLOSED: "Закрыт",
};

const AUDIT_LABELS: Record<string, string> = {
  GOVERNMENT_REQUEST_CREATED: "Запрос зарегистрирован",
  GOVERNMENT_REQUEST_VIEWED: "Карточка просмотрена",
  GOVERNMENT_REQUEST_STATUS_CHANGED: "Статус изменён",
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}
function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export function GovernmentRequestsClient({
  cases,
  initialPage,
  hasMore,
}: {
  cases: CaseSummary[];
  initialPage: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState("");

  async function loadCase(id: string) {
    setSelected(id);
    setDetail(null);
    setHistory([]);
    setError("");
    try {
      const result = await fetch("/api/admin/government-requests/" + encodeURIComponent(id), { cache: "no-store" });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Не удалось открыть запрос");
      setDetail(data.case);
      setHistory(data.history);
      setResolutionNote(data.case.resolutionNote || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка открытия");
    }
  }

  async function submitCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    try {
      const result = await fetch("/api/admin/government-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Ошибка сохранения");
      setCreating(false);
      router.refresh();
      await loadCase(data.case.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: Exclude<GovernmentCaseStatus, "RECEIVED">) {
    if (!selected || !detail) return;
    if ((status === "REJECTED" || status === "CLOSED") && !resolutionNote.trim()) {
      setError("Для завершения или отказа требуется причина и результат рассмотрения.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await fetch("/api/admin/government-requests/" + encodeURIComponent(selected), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNote: resolutionNote.trim() || undefined }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Не удалось изменить статус");
      router.refresh();
      await loadCase(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения статуса");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500">Безопасность</div>
          <h1 className="text-2xl font-semibold text-gray-900">Запросы на предоставление данных</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Закрытый реестр официальных обращений. Этот раздел не раскрывает и не экспортирует персональные данные.
          </p>
        </div>
        <button type="button" onClick={() => { setCreating(!creating); setError(""); }} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          {creating ? "Скрыть форму" : "+ Зарегистрировать запрос"}
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Проверка подлинности, полномочий органа и правового основания выполняется до любого раскрытия данных.
        Файлы запросов, расшифровка телефонов и экспорт здесь пока недоступны.
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {creating && (
        <form onSubmit={submitCase} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Новый официальный запрос</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">Наименование органа
              <input required name="authorityName" minLength={3} maxLength={180} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="block text-sm font-medium">Входящий номер документа
              <input required name="incomingNumber" maxLength={120} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="block text-sm font-medium">Дата поступления
              <input required type="date" name="receivedDate" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="block text-sm font-medium">Внутренний ID пользователя (необязательно)
              <input name="subjectUserId" maxLength={120} placeholder="Только ID, без телефона" className="mt-1 w-full rounded-lg border p-2" />
            </label>
          </div>
          <label className="block text-sm font-medium">Заявленное правовое основание
            <textarea required name="legalBasis" minLength={8} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="block text-sm font-medium">Запрошенный объём сведений
            <textarea required name="requestedScope" minLength={8} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <p className="text-xs text-gray-500">Не вводите в свободные поля телефоны, паспортные данные, переписки или копии документов.</p>
          <button disabled={saving} type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Сохранение…" : "Зарегистрировать"}
          </button>
        </form>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b px-5 py-4 font-semibold">Реестр обращений</h2>
          {cases.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">Запросов на этой странице нет.</p>
          ) : (
            <div className="divide-y">
              {cases.map((item) => (
                <button type="button" key={item.id} onClick={() => void loadCase(item.id)}
                  className={"block w-full px-5 py-4 text-left hover:bg-gray-50 " + (selected === item.id ? "bg-gray-50" : "")}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{item.authorityName}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs">{STATUS_LABELS[item.status]}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">Вх. № {item.incomingNumber} · {dateLabel(item.receivedAt)}</div>
                  <div className="mt-1 font-mono text-[11px] text-gray-400">ID: {item.id}</div>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            {initialPage > 1 ? (
              <Link href={"?page=" + (initialPage - 1)} className="underline">Назад</Link>
            ) : <span />}
            <span className="text-gray-500">Страница {initialPage}</span>
            {hasMore ? <Link href={"?page=" + (initialPage + 1)} className="underline">Далее</Link> : <span />}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Карточка запроса</h2>
          {!selected && <p className="mt-5 text-sm text-gray-500">Выберите обращение для просмотра истории и статуса.</p>}
          {selected && !detail && <p className="mt-5 text-sm text-gray-500">Загрузка или запрос недоступен.</p>}
          {detail && (
            <div className="mt-4 space-y-4 text-sm">
              <div><span className="text-gray-500">Статус:</span> <strong>{STATUS_LABELS[detail.status]}</strong></div>
              <div><div className="text-gray-500">Основание (заявленное)</div><p className="whitespace-pre-wrap break-words">{detail.legalBasis}</p></div>
              <div><div className="text-gray-500">Объём запроса</div><p className="whitespace-pre-wrap break-words">{detail.requestedScope}</p></div>
              <div><span className="text-gray-500">Внутренний ID:</span> <span className="break-all font-mono">{detail.subjectUserId || "Не указан"}</span></div>
              {detail.resolutionNote && <div><div className="text-gray-500">Итог рассмотрения</div><p className="whitespace-pre-wrap break-words">{detail.resolutionNote}</p></div>}

              {(detail.status === "RECEIVED" || detail.status === "IN_REVIEW") && (
                <div className="space-y-3 border-t pt-4">
                  <label className="block font-medium">Результат или причина отказа
                    <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)}
                      maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border p-2" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {detail.status === "RECEIVED" && (
                      <button type="button" disabled={saving} onClick={() => void changeStatus("IN_REVIEW")} className="rounded-lg bg-gray-900 px-3 py-2 text-white disabled:opacity-50">
                        Начать проверку
                      </button>
                    )}
                    <button type="button" disabled={saving} onClick={() => void changeStatus("REJECTED")} className="rounded-lg border px-3 py-2 disabled:opacity-50">
                      Отклонить
                    </button>
                    {detail.status === "IN_REVIEW" && (
                      <button type="button" disabled={saving} onClick={() => void changeStatus("CLOSED")} className="rounded-lg border px-3 py-2 disabled:opacity-50">
                        Закрыть дело
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Закрытие дела — административная отметка, не подтверждение отправки данных.</p>
                </div>
              )}
              <div className="border-t pt-4">
                <h3 className="font-semibold">Журнал действий по запросу</h3>
                {history.length === 0 && <p className="mt-2 text-gray-500">Записей пока нет.</p>}
                <ul className="mt-2 space-y-2">
                  {history.map((item) => (
                    <li key={item.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                      <div className="font-medium">{AUDIT_LABELS[item.action] || item.action}</div>
                      <div className="text-gray-500">{dateTimeLabel(item.createdAt)} · Администратор: {item.actorId || "Системная запись"}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
