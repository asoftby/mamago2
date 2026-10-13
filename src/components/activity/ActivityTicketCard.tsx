"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

export type ActivityTicketPriceMode = "FREE" | "FROM" | "EXACT" | "UNKNOWN";

export type ActivityTicketSource = {
  title: string;
  imageUrl?: string | null;
  venue?: string | null;
  address?: string | null;
  priceMode?: ActivityTicketPriceMode | null;
  priceValue?: number | string | null;
  /** Existing public display value; used only when it contains a trustworthy price. */
  priceLabel?: string | null;
};

export type ActivityTicketViewModel = {
  title: string;
  imageUrl: string | null;
  venue: string | null;
  address: string | null;
  price: { kind: "free"; label: "Бесплатно" } | { kind: "paid"; label: string } | null;
};

function clean(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function numericPrice(value?: number | string | null): string | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? String(value) : null;
  const match = value?.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
}

export function adaptActivityTicket(source: ActivityTicketSource): ActivityTicketViewModel {
  const mode = source.priceMode ?? "UNKNOWN";
  if (mode === "FREE") {
    return {
      title: source.title,
      imageUrl: clean(source.imageUrl),
      venue: clean(source.venue),
      address: clean(source.address),
      price: { kind: "free", label: "Бесплатно" },
    };
  }

  const label = clean(source.priceLabel);
  const labelSaysFree = label ? /^(бесплатно|free)$/i.test(label) : false;
  const labelSaysFrom = label ? /^от\s/i.test(label) : false;
  const amount = numericPrice(source.priceValue) ?? numericPrice(label);
  const price = labelSaysFree
    ? { kind: "free" as const, label: "Бесплатно" as const }
    : amount && (mode === "FROM" || labelSaysFrom)
      ? { kind: "paid" as const, label: `от ${amount} Br` }
      : amount && mode !== "UNKNOWN"
        ? { kind: "paid" as const, label: `${amount} Br` }
        : amount && label
          ? { kind: "paid" as const, label: `${amount} Br` }
          : null;

  return {
    title: source.title,
    imageUrl: clean(source.imageUrl),
    venue: clean(source.venue),
    address: clean(source.address),
    price,
  };
}

export function ActivityTicketCard({ source }: { source: ActivityTicketSource }) {
  const ticket = adaptActivityTicket(source);
  return (
    <article
      aria-label={`Информация: ${ticket.title}`}
      className="relative flex min-h-[94px] w-full min-w-0 overflow-hidden rounded-[18px] bg-[#FAF1E5] text-[#141210]"
    >
      <div className="absolute -left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-white" aria-hidden />
      <div className="absolute -right-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-white" aria-hidden />

      <div className="m-2 mr-0 h-[78px] w-[70px] shrink-0 overflow-hidden rounded-[12px] bg-[#EDE8DF] sm:w-[76px]">
        {ticket.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ticket sources may use external media hosts.
          <img src={ticket.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            aria-label="Обложка отсутствует"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(20,18,16,0.07) 9px, rgba(20,18,16,0.07) 10px)",
            }}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5 sm:px-3.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-[1.25] tracking-[-0.01em] sm:text-[14px]">
          {ticket.title}
        </h3>
        {ticket.venue ? <p className="mt-1 truncate text-[11px] leading-[1.25] text-[rgba(20,18,16,.62)]">{ticket.venue}</p> : null}
        {ticket.address ? (
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] leading-[1.2] text-[rgba(20,18,16,.52)]">
            <MapPin className="h-3 w-3 shrink-0 text-[#E86A3A]" aria-hidden />
            <span className="truncate">{ticket.address}</span>
          </p>
        ) : null}
      </div>

      <div className="relative flex w-[48px] shrink-0 items-center justify-center border-l border-dashed border-[rgba(20,18,16,.22)] sm:w-[56px]">
        {ticket.price?.kind === "free" ? (
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C24E22] [writing-mode:vertical-rl] rotate-180">
            Бесплатно
          </span>
        ) : ticket.price ? (
          <span className="px-1 text-center text-[11px] font-semibold leading-[1.15]">{ticket.price.label}</span>
        ) : null}
      </div>
    </article>
  );
}
