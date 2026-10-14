"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { createIdempotencyKey, maxExtendUntil, type InboxItem } from "@/lib/business/bookingsInbox";
import { toast } from "@/lib/toast";
import { postInboxAction } from "./inboxApi";
import { formatInboxSchedule, partyEventStart, toDateTimeLocal } from "./inboxFormat";

interface OverlayProps {
  item: InboxItem | null;
  onClose: () => void;
  /** Вызывается после успешного действия — перечитать инбокс и бейдж. */
  onDone: () => void;
}

const fieldClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

type ReplyType = "AS_REQUESTED" | "MODIFIED" | "DECLINED";
const REPLY_OPTIONS: Array<{ value: ReplyType; label: string; hint: string }> = [
  { value: "AS_REQUESTED", label: "Подходит", hint: "Дата и формат как в заявке" },
  { value: "MODIFIED", label: "С изменениями", hint: "Предложите другие условия" },
  { value: "DECLINED", label: "Отказаться", hint: "Не сможем провести" },
];
const DECLINE_REASONS: Array<{ value: string; label: string }> = [
  { value: "DATE_BUSY", label: "Дата занята" },
  { value: "BUDGET", label: "Бюджет не подходит" },
  { value: "FORMAT", label: "Другой формат" },
  { value: "NOT_ENOUGH_TIME", label: "Не хватает времени на подготовку" },
  { value: "OTHER", label: "Другая причина" },
];

export function PartyReplyOverlay({ item, onClose, onDone }: OverlayProps) {
  return (
    <ResponsiveOverlay
      open={Boolean(item)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      a11yTitle="Ответ на заявку на праздник"
      title="Ответ на заявку"
      subtitle={item ? `${item.title ?? "Праздник"} · ${formatInboxSchedule(item)}` : undefined}
    >
      {item ? <PartyReplyForm key={item.id} item={item} onClose={onClose} onDone={onDone} /> : null}
    </ResponsiveOverlay>
  );
}

function PartyReplyForm({ item, onClose, onDone }: { item: InboxItem; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<ReplyType>("AS_REQUESTED");
  const [price, setPrice] = useState("");
  const [includes, setIncludes] = useState("");
  const [duration, setDuration] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [prepayment, setPrepayment] = useState("");
  const [cancellation, setCancellation] = useState("");
  const [declineReason, setDeclineReason] = useState("DATE_BUSY");
  const [declineComment, setDeclineComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Один ключ на форму: повторное нажатие после обрыва сети не создаст дубль.
  const keyRef = useRef(createIdempotencyKey("party-respond"));

  const submit = async () => {
    setError(null);
    const expectedStage = item.partyStage === "AWAITING_RECONFIRM" ? "AWAITING_RECONFIRM" : "SENT";
    const base = { expectedStage, expectedQuoteVersion: item.quote?.version ?? 0 };
    let body: Record<string, unknown>;
    if (type === "DECLINED") {
      if (declineReason === "OTHER" && !declineComment.trim()) {
        setError("Укажите причину отказа");
        return;
      }
      body = {
        type, ...base, declineReason,
        ...(declineComment.trim() ? { declineComment: declineComment.trim() } : {}),
      };
    } else {
      const priceByn = Number(price.replace(",", "."));
      if (!Number.isFinite(priceByn) || priceByn <= 0) {
        setError("Укажите стоимость в BYN");
        return;
      }
      if (!includes.trim()) {
        setError("Опишите, что входит в стоимость");
        return;
      }
      if (type === "MODIFIED" && changeReason.trim().length < 5) {
        setError("Объясните, что вы меняете (от 5 символов)");
        return;
      }
      const minutes = duration.trim() ? Number(duration) : undefined;
      if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440)) {
        setError("Длительность — от 15 до 1440 минут");
        return;
      }
      body = {
        type, ...base, priceByn, includes: includes.trim(),
        ...(minutes !== undefined ? { durationMinutes: minutes } : {}),
        ...(type === "MODIFIED" ? { changeReason: changeReason.trim() } : {}),
        ...(prepayment.trim() ? { prepaymentTerms: prepayment.trim() } : {}),
        ...(cancellation.trim() ? { cancellationTerms: cancellation.trim() } : {}),
      };
    }
    setSubmitting(true);
    try {
      await postInboxAction(
        `/api/business/party-requests/${item.id}/respond`, body, "party-respond", keyRef.current,
      );
      toast.success(type === "DECLINED" ? "Отказ отправлен" : "Ответ отправлен клиенту");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить ответ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        <div role="radiogroup" aria-label="Тип ответа" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {REPLY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={type === opt.value}
              onClick={() => setType(opt.value)}
              className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                type === opt.value ? "border-sky-400 bg-sky-50" : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <span className="block text-sm font-semibold text-stone-900">{opt.label}</span>
              <span className="block text-xs text-stone-500">{opt.hint}</span>
            </button>
          ))}
        </div>

        {type === "DECLINED" ? (
          <>
            <div>
              <label className={labelClass} htmlFor="decline-reason">Причина</label>
              <select id="decline-reason" className={fieldClass} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}>
                {DECLINE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="decline-comment">Комментарий{declineReason === "OTHER" ? "" : " (необязательно)"}</label>
              <textarea id="decline-comment" className={fieldClass} rows={3} maxLength={2000} value={declineComment} onChange={(e) => setDeclineComment(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="reply-price">Стоимость, BYN</label>
              <Input id="reply-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Например, 450" />
            </div>
            <div>
              <label className={labelClass} htmlFor="reply-includes">Что входит</label>
              <textarea id="reply-includes" className={fieldClass} rows={3} maxLength={2000} value={includes} onChange={(e) => setIncludes(e.target.value)} />
            </div>
            {type === "MODIFIED" ? (
              <div>
                <label className={labelClass} htmlFor="reply-change">Что меняете и почему</label>
                <textarea id="reply-change" className={fieldClass} rows={2} maxLength={2000} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
              </div>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="reply-duration">Длительность, минут (необязательно)</label>
              <Input id="reply-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="reply-prepay">Условия предоплаты (необязательно)</label>
              <textarea id="reply-prepay" className={fieldClass} rows={2} maxLength={2000} value={prepayment} onChange={(e) => setPrepayment(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="reply-cancel">Условия отмены (необязательно)</label>
              <textarea id="reply-cancel" className={fieldClass} rows={2} maxLength={2000} value={cancellation} onChange={(e) => setCancellation(e.target.value)} />
            </div>
          </>
        )}
        <p className="text-xs text-stone-500">
          Контакты родителя откроются после подтверждения праздника.
        </p>
        {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-stone-200 px-4 py-3 sm:px-5">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose} disabled={submitting}>Отмена</Button>
        <Button type="button" className="h-11 flex-1" onClick={submit} disabled={submitting}>
          {submitting ? "Отправляем…" : type === "DECLINED" ? "Отправить отказ" : "Отправить ответ"}
        </Button>
      </div>
    </div>
  );
}

export function PartyResolveOverlay({ item, onClose, onDone }: OverlayProps) {
  return (
    <ResponsiveOverlay
      open={Boolean(item)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      a11yTitle="Предложение истекло"
      title="Предложение истекло"
      subtitle={item ? `${item.title ?? "Праздник"} · ${formatInboxSchedule(item)}` : undefined}
    >
      {item ? <PartyResolveForm key={item.id} item={item} onClose={onClose} onDone={onDone} /> : null}
    </ResponsiveOverlay>
  );
}

function PartyResolveForm({ item, onClose, onDone }: { item: InboxItem; onClose: () => void; onDone: () => void }) {
  const limit = useMemo(() => maxExtendUntil(new Date(), partyEventStart(item)), [item]);
  // Небольшой запас, чтобы значение не вышло за предел, пока форму заполняют.
  const initial = useMemo(() => new Date(limit.getTime() - 10 * 60_000), [limit]);
  const canExtend = limit.getTime() - Date.now() > 20 * 60_000;
  const [validUntil, setValidUntil] = useState(toDateTimeLocal(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const keyRef = useRef({ EXTEND: createIdempotencyKey("party-extend"), CLOSE: createIdempotencyKey("party-close") });
  const version = item.quote?.version ?? 1;

  const run = async (action: "EXTEND" | "CLOSE") => {
    setError(null);
    let body: Record<string, unknown> = { action, expectedQuoteVersion: version };
    if (action === "EXTEND") {
      const date = new Date(validUntil);
      if (Number.isNaN(date.getTime()) || date.getTime() > limit.getTime() || date.getTime() <= Date.now() + 60_000) {
        setError("Срок — не более 24 часов и не позже чем за час до праздника");
        return;
      }
      body = { ...body, validUntil: date.toISOString() };
    }
    setSubmitting(true);
    try {
      await postInboxAction(
        `/api/business/party-requests/${item.id}/resolve`, body, `party-${action.toLowerCase()}`, keyRef.current[action],
      );
      toast.success(action === "EXTEND" ? "Предложение продлено" : "Заявка закрыта");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить действие");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        <p className="text-sm text-stone-600">
          Клиент не ответил вовремя. Продлите предложение ещё на срок до 24 часов или закройте заявку.
        </p>
        {canExtend ? (
          <div>
            <label className={labelClass} htmlFor="extend-until">Действует до</label>
            <input
              id="extend-until"
              type="datetime-local"
              className={fieldClass}
              value={validUntil}
              max={toDateTimeLocal(limit)}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        ) : (
          <p className="text-sm text-stone-500">До праздника осталось слишком мало времени для продления.</p>
        )}
        {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-stone-200 px-4 py-3 sm:flex-row sm:px-5">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => run("CLOSE")} disabled={submitting}>
          Закрыть заявку
        </Button>
        {canExtend ? (
          <Button type="button" className="h-11 flex-1" onClick={() => run("EXTEND")} disabled={submitting}>
            {submitting ? "Сохраняем…" : "Продлить"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type NotHeldReason = "CLIENT_NO_SHOW" | "CANCELLED_BY_PHONE";

export function VisitOutcomeOverlay({ item, onClose, onDone }: OverlayProps) {
  const [reason, setReason] = useState<NotHeldReason>("CLIENT_NO_SHOW");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = async (outcome: "HELD" | "NOT_HELD") => {
    if (!item) return;
    setError(null);
    setSubmitting(true);
    try {
      await postInboxAction(
        `/api/business/bookings/${item.id}/outcome`,
        outcome === "HELD" ? { outcome } : { outcome, reason },
      );
      toast.success(outcome === "HELD" ? "Визит отмечен как состоявшийся" : "Визит отмечен как несостоявшийся");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveOverlay
      open={Boolean(item)}
      onOpenChange={(open) => { if (!open) { setError(null); onClose(); } }}
      a11yTitle="Итог визита"
      title="Состоялся ли визит?"
      subtitle={item ? `${item.title ?? "Запись"} · ${formatInboxSchedule(item)}` : undefined}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        <Button type="button" className="h-12 w-full" onClick={() => run("HELD")} disabled={submitting}>
          Да, состоялся
        </Button>
        <div className="space-y-2 rounded-2xl border border-stone-200 p-3">
          <label className={labelClass} htmlFor="not-held-reason">Не состоялся — почему?</label>
          <select id="not-held-reason" className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value as NotHeldReason)}>
            <option value="CLIENT_NO_SHOW">Клиент не пришёл</option>
            <option value="CANCELLED_BY_PHONE">Отменили по телефону</option>
          </select>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => run("NOT_HELD")} disabled={submitting}>
            Не состоялся
          </Button>
          <p className="text-xs text-stone-500">Клиенту сообщение об отмене не отправляется.</p>
        </div>
        {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      </div>
    </ResponsiveOverlay>
  );
}
