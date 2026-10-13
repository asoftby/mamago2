"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";

type Stage = "SENT" | "AWAITING_RECONFIRM" | "QUOTED" | "DECLINED" |
  "EXPIRED" | "NOT_ACCEPTED" | "CONFIRMED" | "CANCELLED";
type Quote = {
  id: string; version: number; type: "AS_REQUESTED" | "MODIFIED" | "DECLINED";
  status: string; priceByn: string | null; includes: string | null;
  changeReason: string | null; declineReason: string | null;
  declineComment: string | null; validUntil: string | null; createdAt: string;
};
type PartyRequest = {
  id: string; partyStage: Stage; createdAt: string; responseDueAt: string | null;
  offer: { id: string; title: string } | null;
  partyOrderItem: {
    id: string; role: string; category: string; note: string | null;
    partyOrder: {
      id: string; eventDate: string | null; timeFrom: string | null;
      timeTo: string | null; childrenCount: number | null;
      adultsCount: number | null; childAge: number | null;
      budgetByn: string | null; status: string;
    };
  } | null;
  partyQuotes: Quote[];
};
type PartyRequestResponse = { items: PartyRequest[]; attentionCount: number };
type ReplyType = "AS_REQUESTED" | "MODIFIED" | "DECLINED";
const STAGE_LABEL: Record<Stage, string> = {
  SENT: "Ожидает ответа", AWAITING_RECONFIRM: "Нужно подтвердить изменения",
  QUOTED: "Предложение отправлено", DECLINED: "Отказ", EXPIRED: "Срок истёк",
  NOT_ACCEPTED: "Не выбрано", CONFIRMED: "Подтверждено родителем", CANCELLED: "Отменено",
};
const DECLINE_REASONS = [
  ["DATE_BUSY", "Дата занята"], ["BUDGET", "Не подходит бюджет"],
  ["FORMAT", "Не подходит формат"], ["NOT_ENOUGH_TIME", "Недостаточно времени"],
  ["OTHER", "Другая причина"],
] as const;

function dateLabel(date: string | null): string {
  if (!date) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}

function PartyRequestCard({ request, onUpdated }: { request: PartyRequest; onUpdated: () => void }) {
  const [type, setType] = useState<ReplyType | null>(null);
  const [price, setPrice] = useState("");
  const [includes, setIncludes] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [prepaymentTerms, setPrepaymentTerms] = useState("");
  const [cancellationTerms, setCancellationTerms] = useState("");
  const [declineReason, setDeclineReason] = useState("DATE_BUSY");
  const [declineComment, setDeclineComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const order = request.partyOrderItem?.partyOrder;
  const canReply = request.partyStage === "SENT" || request.partyStage === "AWAITING_RECONFIRM";
  const expired = request.responseDueAt ? new Date(request.responseDueAt).getTime() <= Date.now() : true;
  const latest = request.partyQuotes[0];
  const setDirty = (change: () => void) => {
    key.current = null;
    setError(null);
    change();
  };
  const send = async () => {
    if (!type || !canReply || expired) return;
    const value = Number(price.replace(",", "."));
    if (type !== "DECLINED" && (!Number.isFinite(value) || value <= 0 || !includes.trim())) {
      setError("Укажите стоимость в BYN и что входит в услугу");
      return;
    }
    if (type === "MODIFIED" && changeReason.trim().length < 5) {
      setError("Опишите изменения в условиях");
      return;
    }
    if (type === "DECLINED" && declineReason === "OTHER" && !declineComment.trim()) {
      setError("Укажите причину отказа");
      return;
    }
    if (!key.current) key.current = crypto.randomUUID();
    setSaving(true);
    setError(null);
    try {
      const payload = type === "DECLINED"
        ? { type, declineReason, declineComment }
        : { type, priceByn: value, includes, prepaymentTerms, cancellationTerms,
            ...(type === "MODIFIED" ? { changeReason } : {}) };
      const response = await fetch("/api/business/party-requests/" + encodeURIComponent(request.id) + "/respond", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key.current },
        body: JSON.stringify({
          ...payload, expectedStage: request.partyStage,
          expectedQuoteVersion: latest?.version ?? 0,
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Не удалось отправить отклик");
      toast.success(type === "DECLINED" ? "Отказ сохранён" : "Предложение отправлено на рассмотрение родителю");
      onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка отправки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-orange-700">Праздник · {request.partyOrderItem?.role === "ANCHOR" ? "Основной исполнитель" : "Дополнительная услуга"}</p>
          <h3 className="mt-1 text-lg font-semibold">{request.offer?.title ?? "Услуга"}</h3>
          <p className="text-sm text-stone-600">{STAGE_LABEL[request.partyStage]}</p>
        </div>
        {canReply && <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800">
          {expired ? "Срок ответа истёк" : "Ответить до " + new Date(request.responseDueAt!).toLocaleString("ru-RU")}
        </span>}
      </div>
      {order && <div className="grid gap-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-700 sm:grid-cols-2">
        <span>Дата: <strong>{dateLabel(order.eventDate)}</strong></span>
        <span>Время: <strong>{order.timeFrom ?? "—"}–{order.timeTo ?? "—"}</strong></span>
        <span>Дети: <strong>{order.childrenCount ?? "—"}</strong>, взрослые: <strong>{order.adultsCount ?? "—"}</strong></span>
        <span>Возраст ребёнка: <strong>{order.childAge != null ? order.childAge + " лет" : "не указан"}</strong></span>
        {order.budgetByn && <span>Бюджет праздника: <strong>{order.budgetByn} BYN</strong></span>}
        {request.partyOrderItem?.note && <p className="sm:col-span-2">Пожелания: {request.partyOrderItem.note}</p>}
      </div>}
      <p className="text-xs text-stone-500">Контакты родителя откроются после согласования. Отклик не подтверждает бронирование.</p>
      {request.partyQuotes.length > 0 && <details className="rounded-xl border border-stone-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">История предложений ({request.partyQuotes.length})</summary>
        <div className="mt-3 space-y-3">
          {request.partyQuotes.map((quote) => <div key={quote.id} className="border-t border-stone-100 pt-3 text-sm">
            <p className="font-medium">Версия {quote.version} · {quote.type === "DECLINED" ? "Отказ" : quote.type === "MODIFIED" ? "С изменениями" : "Могу"} · {quote.status}</p>
            {quote.priceByn && <p>Стоимость: {quote.priceByn} BYN</p>}
            {quote.includes && <p>Включено: {quote.includes}</p>}
            {quote.changeReason && <p>Изменения: {quote.changeReason}</p>}
            {quote.declineReason && <p>Причина отказа: {quote.declineReason} {quote.declineComment ?? ""}</p>}
            {quote.validUntil && <p>Действует до: {new Date(quote.validUntil).toLocaleString("ru-RU")}</p>}
          </div>)}
        </div>
      </details>}
      {canReply && !expired && <>
        <div className="flex flex-wrap gap-2">
          {([
            ["AS_REQUESTED", "Могу"], ["MODIFIED", "С изменениями"], ["DECLINED", "Не могу"],
          ] as const).map(([value, label]) => (
            <button type="button" key={value} onClick={() => setDirty(() => setType(value))}
              aria-pressed={type === value}
              className={"rounded-xl border px-4 py-2 text-sm font-medium " +
                (type === value ? "border-orange-600 bg-orange-50 text-orange-800" : "border-stone-200 text-stone-700")}>
              {label}
            </button>
          ))}
        </div>
        {type && <div className="space-y-3 rounded-xl border border-stone-200 p-4">
          {type === "DECLINED" ? <>
            <label className="block text-sm">Причина отказа
              <select className="mt-1 w-full rounded-lg border border-stone-300 p-2"
                value={declineReason} onChange={(event) => setDirty(() => setDeclineReason(event.target.value))}>
                {DECLINE_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm">Комментарий
              <textarea className="mt-1 w-full rounded-lg border border-stone-300 p-2" maxLength={2000}
                value={declineComment} onChange={(event) => setDirty(() => setDeclineComment(event.target.value))} />
            </label>
          </> : <>
            <label className="block text-sm">Стоимость услуги, BYN
              <input className="mt-1 w-full rounded-lg border border-stone-300 p-2" type="number" min="1" step="0.01"
                value={price} onChange={(event) => setDirty(() => setPrice(event.target.value))} />
            </label>
            <label className="block text-sm">Что входит в стоимость
              <textarea className="mt-1 w-full rounded-lg border border-stone-300 p-2" maxLength={2000}
                value={includes} onChange={(event) => setDirty(() => setIncludes(event.target.value))} />
            </label>
            {type === "MODIFIED" && <label className="block text-sm">Что изменилось
              <textarea className="mt-1 w-full rounded-lg border border-stone-300 p-2" maxLength={2000}
                value={changeReason} onChange={(event) => setDirty(() => setChangeReason(event.target.value))} />
            </label>}
            <label className="block text-sm">Условия предоплаты
              <textarea className="mt-1 w-full rounded-lg border border-stone-300 p-2" maxLength={2000}
                value={prepaymentTerms} onChange={(event) => setDirty(() => setPrepaymentTerms(event.target.value))} />
            </label>
            <label className="block text-sm">Условия отмены
              <textarea className="mt-1 w-full rounded-lg border border-stone-300 p-2" maxLength={2000}
                value={cancellationTerms} onChange={(event) => setDirty(() => setCancellationTerms(event.target.value))} />
            </label>
          </>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="button" disabled={saving} onClick={() => void send()}
            className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Сохраняем…" : type === "DECLINED" ? "Отправить отказ" : "Отправить предложение"}
          </button>
          <p className="text-xs text-stone-500">Ответ будет направлен родителю на согласование. Бронирование пока не создано.</p>
        </div>}
      </>}
    </article>
  );
}

export function PartyRequestsPanel() {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [data, setData] = useState<PartyRequestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/business/party-requests?filter=" + filter, { credentials: "include", signal });
      if (!response.ok) throw new Error("Не удалось загрузить праздничные заявки");
      const result: PartyRequestResponse = await response.json();
      if (!signal?.aborted) { setData(result); setError(null); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filter]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  return <section className="space-y-5">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setFilter("attention")} aria-pressed={filter === "attention"}
        className={"rounded-xl px-4 py-2 text-sm font-medium " +
          (filter === "attention" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700")}>
        Требуют ответа {data ? "· " + data.attentionCount : ""}
      </button>
      <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"}
        className={"rounded-xl px-4 py-2 text-sm font-medium " +
          (filter === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700")}>
        Все праздничные заявки
      </button>
    </div>
    {loading && <p role="status" className="py-8 text-center text-stone-500">Загружаем заявки…</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
      {error} <button type="button" onClick={() => void refresh()} className="underline">Повторить</button>
    </div>}
    {!loading && !error && data?.items.length === 0 &&
      <p className="rounded-xl bg-stone-50 p-8 text-center text-stone-600">
        {filter === "attention" ? "Сейчас нет праздничных заявок, требующих ответа." : "Праздничных заявок пока нет."}
      </p>}
    {!loading && !error && data?.items.map((request) =>
      <PartyRequestCard key={request.id} request={request} onUpdated={() => void refresh()} />)}
  </section>;
}
