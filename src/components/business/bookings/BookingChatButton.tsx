"use client";

/**
 * «Написать клиенту» / «Открыть чат» для заявки в кабинете бизнеса.
 *
 * - гостевая заявка (нет аккаунта) → ничего не рисуем, вызывающий код оставляет телефон;
 * - тред уже есть → «Открыть чат» (ссылка в /business/direct/{id});
 * - политика платформы отключила Direct → понятное состояние вместо кнопки;
 * - иначе форма первого сообщения → POST /api/business/bookings/{id}/direct.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { toast } from "@/lib/toast";

export type BookingChatTarget = {
  id: string;
  customerName: string;
  hasCustomerAccount: boolean;
  directThreadId: string | null;
  directAvailable: boolean | null;
};

type Props = {
  booking: BookingChatTarget;
  /** Called with the thread id after a thread was created or found. */
  onOpened?: (threadId: string) => void;
  className?: string;
  /** Same size as the drawer's primary actions. */
  large?: boolean;
  /** Round icon-only button (next to the phone action). Renders nothing when chat is unavailable. */
  iconOnly?: boolean;
};

const MAX_LEN = 2000;
const buttonClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-[14px] font-medium text-stone-800 transition-colors hover:border-stone-400";

export function BookingChatButton({ booking, onOpened, className: extra, large, iconOnly }: Props) {
  const iconClass =
    "flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 transition hover:bg-stone-50";
  const className = [large ? "!h-12 w-full justify-center !rounded-2xl !border-stone-300 !px-6 !text-[15px] !font-semibold !text-stone-950" : "", extra ?? ""].join(" ");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking.hasCustomerAccount) return null;

  if (booking.directThreadId) {
    return (
      <Link
        href={`/business/direct/${booking.directThreadId}`}
        className={iconOnly ? iconClass : `${buttonClass} ${className ?? ""}`}
        aria-label={iconOnly ? "Открыть чат" : undefined}
      >
        <MessageCircle className={iconOnly ? "h-5 w-5" : "h-4 w-4"} /> {iconOnly ? null : "Открыть чат"}
      </Link>
    );
  }

  if (booking.directAvailable === false) {
    if (iconOnly) return null;
    return (
      <p className={`text-[13px] text-stone-500 ${className ?? ""}`}>
        Сообщения клиентам для этого типа публикаций сейчас отключены платформой. Свяжитесь по телефону.
      </p>
    );
  }

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
      setOpen(false);
      onOpened?.(json.threadId);
      router.push(`/business/direct/${json.threadId}`);
    } catch {
      setError("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={iconOnly ? iconClass : `${buttonClass} ${className ?? ""}`}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? "Написать клиенту" : undefined}
      >
        <MessageCircle className={iconOnly ? "h-5 w-5" : "h-4 w-4"} /> {iconOnly ? null : "Написать клиенту"}
      </button>
      <ResponsiveOverlay
        open={open}
        onOpenChange={(v) => {
          if (!submitting) setOpen(v);
        }}
        a11yTitle="Написать клиенту"
        variant="framed"
        title="Написать клиенту"
        subtitle={booking.customerName ? `Заявка от ${booking.customerName}` : undefined}
        footer={
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#EF8759] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Отправить"}
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
            rows={5}
            placeholder="Например: здравствуйте! Подтверждаем возможность записи, уточните, пожалуйста…"
            className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 p-3 text-[15px] text-stone-900 outline-none focus:border-[#EF8759]"
          />
          <p className="text-[12px] text-stone-500">
            Клиент получит уведомление и ответит в личных сообщениях. Не отправляйте телефоны и ссылки на внешние
            мессенджеры — такие сообщения отмечаются системой безопасности.
          </p>
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </ResponsiveOverlay>
    </>
  );
}
