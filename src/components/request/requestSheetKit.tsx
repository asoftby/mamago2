"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { SaveActivityHeader } from "@/components/activity/SaveActivityHeader";
import type { ActivityTicketSource } from "@/components/activity/ActivityTicketCard";
import { SaveFlowContainer } from "@/components/activity/SaveFlowContainer";
import { cn } from "@/lib/utils";

/**
 * Единые элементы окон заявки. Визуальный язык окна «Сохранить»: кикер и крупный заголовок, карточка
 * с названием, плашки «для кого» и даты с персиковым выбранным состоянием, итоговая панель «Выбрано».
 * Окна праздника (Party) и события собираются из этих элементов и различаются только полями и отправкой.
 */
export const RS = {
  ink: "#141210",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  peach: "#F7C3AD",
  peachLine: "#F3A684",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
  paper: "#FAF7F1",
  danger: "#B3261E",
} as const;

const mono: CSSProperties = { fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase", letterSpacing: ".12em", fontSize: 10, color: RS.ink3 };

export function RequestSheetFrame({
  open,
  onOpenChange,
  ticket,
  heading,
  kicker = "заявка",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: ActivityTicketSource;
  heading: ReactNode;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <SaveFlowContainer open={open} onOpenChange={onOpenChange} title="Оставить заявку">
      <div className="min-w-0 w-full max-w-full overflow-x-clip px-4 pb-0 pt-0 sm:max-h-[85vh] sm:overflow-y-auto sm:px-6 sm:pt-4">
        <SaveActivityHeader kicker={kicker} heading={heading} ticket={ticket} />
        {children}
      </div>
    </SaveFlowContainer>
  );
}

/** Секция с подписью в стиле «Для кого сохраняем?». */
export function RsSection({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div style={{ ...mono, marginBottom: 9 }}>{label}</div>
      {children}
      {hint && !error ? <p className="m-0 mt-1.5 text-xs" style={{ color: RS.ink3 }}>{hint}</p> : null}
      {error ? <p role="alert" className="m-0 mt-1.5 text-xs font-semibold" style={{ color: RS.danger }}>{error}</p> : null}
    </div>
  );
}

/** Плашка выбора: персиковая, когда выбрана (как «Для всех» / «Я» в окне «Сохранить»). */
export function RsChip({ active, onClick, children, ariaLabel }: { active: boolean; onClick: () => void; children: ReactNode; ariaLabel?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        border: `1px solid ${active ? RS.peachLine : RS.line2}`,
        background: active ? RS.peach : "#fff",
        color: RS.ink,
        borderRadius: 999,
        padding: "8px 13px",
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        minHeight: 40,
      }}
    >
      {children}
    </button>
  );
}

export function RsChipRow({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  return scroll ? (
    <div className="-mx-4 flex gap-[7px] overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
  ) : (
    <div className="flex flex-wrap gap-[7px]">{children}</div>
  );
}

export type RsDateItem = { key: string; weekday: string; day: number; month: string; ariaLabel?: string };

/** Карточки дат с горизонтальной прокруткой, как слайдер дат в окне «Сохранить». */
export function RsDateCards({
  items,
  value,
  onChange,
  trailing,
}: {
  items: RsDateItem[];
  value: string;
  onChange: (key: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((d) => {
        const on = value === d.key;
        return (
          <button
            key={d.key}
            type="button"
            aria-pressed={on}
            aria-label={d.ariaLabel ?? `${d.weekday}, ${d.day} ${d.month}`}
            onClick={() => onChange(d.key)}
            style={{
              flex: "0 0 68px",
              height: 88,
              borderRadius: 18,
              border: `1px solid ${on ? RS.peachLine : "#ECE6DD"}`,
              background: on ? RS.peach : "#fff",
              color: RS.ink,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              cursor: "pointer",
            }}
          >
            <span style={{ ...mono, letterSpacing: ".14em", fontSize: 10.5 }}>{d.weekday}</span>
            <b style={{ fontFamily: "Lora, Georgia, serif", fontWeight: 400, fontSize: 30, lineHeight: 1 }}>{d.day}</b>
            <span style={{ ...mono, fontSize: 10 }}>{d.month}</span>
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

export function RsStepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const btn = "flex size-11 items-center justify-center rounded-full hover:bg-[#F6F2EA] disabled:cursor-not-allowed disabled:text-[#B4ABA0]";
  return (
    <div className="flex items-center gap-1 rounded-full bg-white p-0.5" style={{ border: `1px solid ${RS.line2}` }}>
      <button type="button" aria-label={`${label}: меньше`} disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}>
        <Minus className="size-[18px]" />
      </button>
      <b aria-live="polite" className="min-w-7 text-center text-lg">{value}</b>
      <button type="button" aria-label={`${label}: больше`} disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
        <Plus className="size-[18px]" />
      </button>
    </div>
  );
}

const fieldBase = "w-full rounded-[14px] border bg-[#FAF7F1] px-4 text-[15px] text-[#141210] placeholder:text-[#8E857B] focus:border-[#E86A3A] focus:outline-none focus:ring-[3px] focus:ring-[rgba(232,106,58,.12)]";

export function RsInput({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={cn(fieldBase, "min-h-[52px]", invalid ? "border-[#B3261E]" : "border-[rgba(20,18,16,.10)]", className)} />;
}

export function RsTextarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(fieldBase, "border-[rgba(20,18,16,.10)] py-3 leading-snug", className)} />;
}

/** Итоговая панель «● выбрано … [Отправить заявку]» — закреплена внизу прокручиваемого окна. */
export function RsConfirmBar({
  summary,
  actionLabel,
  onAction,
  disabled,
  busy,
  note,
  label = "выбрано",
}: {
  summary: ReactNode;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  busy?: boolean;
  note?: ReactNode;
  /** Подпись над итогом; по умолчанию «выбрано». */
  label?: string;
}) {
  const off = disabled || busy;
  return (
    <div className="sticky bottom-0 -mx-4 mt-3 bg-white/95 px-4 pb-4 pt-2 backdrop-blur sm:-mx-6 sm:px-6" style={{ borderTop: `1px solid ${RS.line}` }}>
      <div style={{ padding: "14px 16px", background: RS.peach, color: RS.ink, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div className="min-w-0">
          <div style={{ ...mono, letterSpacing: ".1em", marginBottom: 3 }}>● {label}</div>
          <div className="truncate" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>{summary}</div>
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={off}
          style={{
            height: 46,
            padding: "0 20px",
            borderRadius: 999,
            background: off ? "#DBD7D3" : RS.accent,
            color: off ? RS.ink3 : "#fff",
            border: 0,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            cursor: off ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {busy ? "Отправляем…" : actionLabel}
        </button>
      </div>
      {note ? <p className="m-0 mt-2 text-center text-xs" style={{ color: RS.ink3 }}>{note}</p> : null}
    </div>
  );
}

/** Экран «заявка отправлена»: то же оформление, что у остальных шагов. */
export function RsSuccess({ title, text, children }: { title: ReactNode; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center pb-6 pt-2 text-center">
      <span className="flex size-16 items-center justify-center rounded-full" style={{ background: RS.accentSoft, color: RS.accentDeep }}>
        <Check className="size-8" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <h3 className="mb-2 mt-4 font-serif text-[30px] font-normal leading-none">{title}</h3>
      <p className="m-0 max-w-[320px] text-[15px]" style={{ color: RS.ink2 }}>{text}</p>
      {children ? <div className="mt-5 flex w-full flex-col gap-2.5">{children}</div> : null}
    </div>
  );
}

export function RsGhostLink({ children, className, ...rest }: { children: ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...rest} className={cn("inline-flex min-h-12 w-full items-center justify-center rounded-full border text-[15px] font-semibold !text-[#141210] !no-underline hover:border-[#141210]", className)} style={{ borderColor: RS.line2 }}>
      {children}
    </a>
  );
}
