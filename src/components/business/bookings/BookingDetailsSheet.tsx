"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Mail, Phone } from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { RS, RequestSheetFrame, RsConfirmBar, RsSection } from "@/components/request/requestSheetKit";
import { toast } from "@/lib/toast";

export type BookingSheetTone = "new" | "success" | "neutral" | "warning";

/** Готовая к показу модель заявки: форматирование остаётся в BookingsPageClient. */
export interface BookingSheetView {
  id: string;
  status: BookingStatus;
  title: string;
  typeLabel: string;
  schedule: string;
  /** Строка цены; символ BYN выводит карточка окна через BelarusianRubleIcon. */
  priceLabel: string | null;
  statusLabel: string;
  statusTone: BookingSheetTone;
  actionLabel: string | null;
  receivedLabel: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  isManual: boolean;
  participant: { primary: string; secondary: string[] } | null;
  details: string[];
  historyLabel: string;
  customerComment: string | null;
}

const TONE_STYLE: Record<BookingSheetTone, CSSProperties> = {
  new: { background: RS.peach, color: RS.ink, border: `1px solid ${RS.peachLine}` },
  success: { background: RS.successSoft, color: RS.success, border: "1px solid rgba(4,120,87,.25)" },
  warning: { background: RS.accentSoft, color: RS.accentDeep, border: "1px solid rgba(232,106,58,.3)" },
  neutral: { background: "#fff", color: RS.ink2, border: `1px solid ${RS.line2}` },
};

function Pill({ tone, children }: { tone: BookingSheetTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={TONE_STYLE[tone]}>
      {children}
    </span>
  );
}

const outlineBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full border bg-white px-5 text-sm font-semibold transition hover:border-[#141210] disabled:cursor-not-allowed disabled:opacity-60";

function IconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-full border bg-white transition hover:border-[#141210]"
      style={{ borderColor: RS.line2, color: RS.ink }}
    >
      {children}
    </a>
  );
}

function DetailLine({ children }: { children: ReactNode }) {
  return <div className="text-[15px] leading-6" style={{ color: RS.ink2 }}>{children}</div>;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] px-4 py-3.5" style={{ background: RS.paper, border: `1px solid ${RS.line}` }}>
      {children}
    </div>
  );
}

/** Окно с деталями заявки в кабинете бизнеса: тот же набор, что у «Сохранить» и «Записаться на событие». */
export function BookingDetailsSheet({
  open,
  view,
  selectedIndex,
  total,
  onOpenChange,
  onSelectPrev,
  onSelectNext,
  onStatusChange,
}: {
  open: boolean;
  view: BookingSheetView | null;
  selectedIndex: number;
  total: number;
  onOpenChange: (open: boolean) => void;
  onSelectPrev: () => void;
  onSelectNext: () => void;
  onStatusChange: (id: string, status: BookingStatus) => Promise<void>;
}) {
  const [updating, setUpdating] = useState<BookingStatus | null>(null);
  if (!view) return null;

  const canConfirm = view.status === BookingStatus.NEW;
  const canReject = view.status === BookingStatus.NEW || view.status === BookingStatus.CONFIRMED;
  const canComplete = view.status === BookingStatus.CONFIRMED;

  const handleAction = async (status: BookingStatus) => {
    setUpdating(status);
    try {
      await onStatusChange(view.id, status);
    } finally {
      setUpdating(null);
    }
  };

  const primary = canConfirm
    ? { label: "Подтвердить заявку", status: BookingStatus.CONFIRMED, tone: "success" as const }
    : canComplete
      ? { label: "Завершить", status: BookingStatus.COMPLETED, tone: "accent" as const }
      : null;

  const ticketMode = view.priceLabel && /^от\s/i.test(view.priceLabel) ? "FROM" : "UNKNOWN";

  return (
    <RequestSheetFrame
      open={open}
      onOpenChange={onOpenChange}
      kicker="заявка"
      heading="Детали заявки"
      ticket={{
        title: view.title,
        venue: [view.typeLabel, view.schedule].filter(Boolean).join(" · "),
        priceMode: ticketMode,
        priceLabel: view.priceLabel,
      }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone={view.statusTone}>{view.statusLabel}</Pill>
        {view.actionLabel ? <Pill tone="warning">{view.actionLabel}</Pill> : null}
        <span className="text-xs" style={{ color: RS.ink3 }}>{view.receivedLabel}</span>
      </div>

      {total > 1 ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSelectPrev}
            disabled={selectedIndex <= 0}
            aria-label="Предыдущая заявка"
            className="flex size-11 items-center justify-center rounded-full border bg-white transition hover:border-[#141210] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: RS.line2, color: RS.ink }}
          >
            <ChevronLeft className="size-5" />
          </button>
          <span aria-live="polite" className="text-xs" style={{ color: RS.ink3 }}>
            Заявка {selectedIndex + 1} из {total}
          </span>
          <button
            type="button"
            onClick={onSelectNext}
            disabled={selectedIndex < 0 || selectedIndex >= total - 1}
            aria-label="Следующая заявка"
            className="flex size-11 items-center justify-center rounded-full border bg-white transition hover:border-[#141210] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: RS.line2, color: RS.ink }}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      ) : null}

      <RsSection label="Клиент">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold" style={{ color: RS.ink }}>{view.customerName}</div>
              <DetailLine>{view.customerPhone}</DetailLine>
              {view.customerEmail ? <DetailLine>{view.customerEmail}</DetailLine> : null}
              {view.isManual ? <DetailLine>Добавлено вручную</DetailLine> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IconLink href={`tel:${view.customerPhone}`} label="Позвонить клиенту">
                <Phone className="size-[18px]" />
              </IconLink>
              {view.customerEmail ? (
                <IconLink href={`mailto:${view.customerEmail}`} label="Написать клиенту">
                  <Mail className="size-[18px]" />
                </IconLink>
              ) : null}
            </div>
          </div>
        </Card>
      </RsSection>

      {view.participant ? (
        <RsSection label="Участник">
          <Card>
            <div className="text-base font-semibold" style={{ color: RS.ink }}>{view.participant.primary}</div>
            {view.participant.secondary.map((line) => <DetailLine key={line}>{line}</DetailLine>)}
          </Card>
        </RsSection>
      ) : null}

      <RsSection label="Детали заявки">
        <Card>
          {view.details.length > 0 ? (
            <>
              <div className="text-base font-semibold" style={{ color: RS.ink }}>{view.details[0]}</div>
              {view.details.slice(1).map((line) => <DetailLine key={line}>{line}</DetailLine>)}
            </>
          ) : (
            <div className="text-base font-semibold" style={{ color: RS.ink }}>Детали уточняются</div>
          )}
        </Card>
      </RsSection>

      <RsSection label="История статуса">
        <Card>
          <div className="text-base font-semibold" style={{ color: RS.ink }}>{view.statusLabel}</div>
          <DetailLine>{view.historyLabel}</DetailLine>
        </Card>
      </RsSection>

      {view.customerComment ? (
        <RsSection label="Комментарий клиента">
          <Card>
            <div className="text-[15px] leading-6" style={{ color: RS.ink }}>{view.customerComment}</div>
          </Card>
        </RsSection>
      ) : null}

      <div className="mb-1 flex flex-wrap gap-2">
        <a href={`tel:${view.customerPhone}`} className={outlineBtn} style={{ borderColor: RS.line2, color: RS.ink }}>
          Позвонить клиенту
        </a>
        {view.customerEmail ? (
          <a href={`mailto:${view.customerEmail}`} className={outlineBtn} style={{ borderColor: RS.line2, color: RS.ink }}>
            Написать клиенту
          </a>
        ) : (
          <button
            type="button"
            className={outlineBtn}
            style={{ borderColor: RS.line2, color: RS.ink }}
            onClick={() => toast.message("Добавим чат с клиентом в следующем обновлении")}
          >
            Написать клиенту
          </button>
        )}
        {canReject ? (
          <button
            type="button"
            className={outlineBtn}
            style={{ borderColor: "rgba(179,38,30,.35)", color: RS.danger }}
            disabled={updating === BookingStatus.REJECTED}
            onClick={() => handleAction(BookingStatus.REJECTED)}
          >
            {updating === BookingStatus.REJECTED ? "Сохраняем…" : "Отклонить"}
          </button>
        ) : null}
      </div>

      {primary ? (
        <RsConfirmBar
          label="заявка"
          summary={`${view.statusLabel} · ${view.customerName}`}
          actionLabel={primary.label}
          tone={primary.tone}
          busy={updating === primary.status}
          busyLabel="Сохраняем…"
          onAction={() => handleAction(primary.status)}
        />
      ) : (
        <div className="h-4" />
      )}
    </RequestSheetFrame>
  );
}
