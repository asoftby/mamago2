"use client";

/**
 * «Написать клиенту» для заявки в кабинете бизнеса, встроенное в модалку деталей заявки.
 *
 * - `BookingChatButton`: кнопка. Гостевая заявка (нет аккаунта) → ничего; тред уже есть →
 *   «Открыть чат» (ссылка в /business/direct/{id}); политика платформы отключила Direct →
 *   для иконки ничего, для большой кнопки понятное состояние; иначе вызывает `onCompose`.
 * - `BookingChatCompose`: отдельный шаг внутри модалки (форма первого сообщения →
 *   POST /api/business/bookings/{id}/direct).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "@/lib/toast";

export type BookingChatTarget = {
  id: string;
  customerName: string;
  hasCustomerAccount: boolean;
  directThreadId: string | null;
  directAvailable: boolean | null;
};

const MAX_LEN = 2000;
const iconClass =
  "flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 transition hover:bg-stone-50";
const wideClass =
  "inline-flex h-12 w-full items-center justify-center rounded-2xl border border-stone-300 bg-white px-6 text-[15px] font-semibold text-stone-950 transition hover:bg-stone-50";

export function BookingChatButton({
  booking,
  onCompose,
  iconOnly,
}: {
  booking: BookingChatTarget;
  onCompose: () => void;
  /** Round icon-only button (next to the phone action). */
  iconOnly?: boolean;
}) {
  if (!booking.hasCustomerAccount) return null;
  const className = iconOnly ? iconClass : wideClass;
  const icon = iconOnly ? <MessageCircle className="h-5 w-5" /> : null;
  const label = iconOnly ? null : "Написать клиенту";

  if (booking.directThreadId) {
    return (
      <Link
        href={`/business/direct/${booking.directThreadId}`}
        className={className}
        aria-label={iconOnly ? "Открыть чат" : undefined}
      >
        {icon}
        {iconOnly ? null : "Открыть чат"}
      </Link>
    );
  }

  if (booking.directAvailable === false) {
    if (iconOnly) return null;
    return (
      <p className="text-center text-[13px] text-stone-500">
        Сообщения клиентам для этого типа публикаций сейчас отключены платформой. Свяжитесь по телефону.
      </p>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onCompose}
      aria-label={iconOnly ? "Написать клиенту" : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

/** Chat step rendered inside the details drawer in place of the details view. */
export function BookingChatCompose({
  booking,
  subtitle,
  onBack,
  onClose,
}: {
  booking: BookingChatTarget;
  subtitle?: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = message.trim();
    if (!text) {
      setError("Введите сообщение");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/bookings/${booking.id}/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = (await res.json().catch(() => ({}))) as { threadId?: string; error?: string };
      if (!res.ok || !json.threadId) {
        setError(json.error ?? "Не удалось отправить сообщение. Попробуйте ещё раз.");
        return;
      }
      toast.success("Сообщение отправлено");
      router.push(`/business/direct/${json.threadId}`);
    } catch {
      setError("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-1 rounded-full pl-2 pr-4 text-[15px] font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" />
            Заявка
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
            aria-label="Закрыть детали"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h3 className="mt-5 text-[1.6rem] font-bold leading-tight tracking-tight text-stone-950 sm:text-[1.75rem]">
          Написать клиенту
        </h3>
        <div className="mt-2 text-[15px] text-stone-600">
          {booking.customerName ? `Заявка от ${booking.customerName}` : null}
          {subtitle ? <span className="block text-[13px] text-stone-500">{subtitle}</span> : null}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
          rows={7}
          autoFocus
          placeholder="Например: здравствуйте! Подтверждаем возможность записи, уточните, пожалуйста…"
          className="mt-5 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-4 text-[15px] text-stone-900 outline-none focus:border-stone-400"
        />
        <p className="mt-3 text-[13px] leading-5 text-stone-500">
          Клиент получит уведомление и ответит в личных сообщениях. Не отправляйте телефоны и ссылки на внешние
          мессенджеры — такие сообщения отмечаются системой безопасности.
        </p>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-stone-200 bg-white px-5 pb-5 pt-4 sm:px-6">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-6 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Отправить"}
        </button>
      </div>
    </>
  );
}
