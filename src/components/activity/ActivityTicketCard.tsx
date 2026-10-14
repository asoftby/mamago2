"use client";

import * as React from "react";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";

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
  price: { kind: "free"; label: "Бесплатно" } | { kind: "paid"; label: string; amount: string; isFrom: boolean } | null;
};

function clean(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function numericPrice(value?: number | string | null): string | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? String(value) : null;
  const match = value?.match(/\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?/);
  if (!match) return null;
  const number = Number(match[0].replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
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
  const labelSaysFrom = label ? /^от\s/i.test(label) || /\d\s*[–—-]\s*\d/.test(label) : false;
  const amount = numericPrice(source.priceValue) ?? numericPrice(label);
  const isFrom = mode === "FROM" || labelSaysFrom;
  const price = labelSaysFree
    ? { kind: "free" as const, label: "Бесплатно" as const }
    : amount && (mode !== "UNKNOWN" || label)
      ? {
          kind: "paid" as const,
          label: `${isFrom ? "от " : ""}${amount} ${BYN_SYMBOL}`,
          amount,
          isFrom,
        }
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
      className="relative isolate flex min-h-[112px] w-full min-w-0 overflow-hidden rounded-[20px] bg-[#726d65] text-white shadow-[0_12px_30px_rgba(20,18,16,0.18)]"
      // A real alpha mask cuts the paper notches out of the entire ticket (image and overlay),
      // so the surrounding modal remains visible instead of covering the image with white circles.
      style={{
        maskImage: "radial-gradient(circle 10px at left center, transparent 9.5px, black 10.5px), radial-gradient(circle 10px at right center, transparent 9.5px, black 10.5px)",
        maskComposite: "intersect",
      }}
    >
      {ticket.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ticket sources may use external media hosts.
        <img
          src={ticket.imageUrl}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
      ) : (
        <div
          className="absolute inset-0 -z-20"
          aria-label="Обложка отсутствует"
          style={{
            backgroundImage:
              "radial-gradient(circle at 78% 18%, rgba(236,132,83,.72), transparent 38%), linear-gradient(135deg, #71655d 0%, #413b38 54%, #262321 100%)",
          }}
        />
      )}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,14,13,.84)_0%,rgba(16,14,13,.67)_50%,rgba(16,14,13,.32)_100%)]"
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pl-5 pr-3 sm:pl-6 sm:pr-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.2] tracking-[-0.015em] drop-shadow-[0_1px_2px_rgba(0,0,0,.35)] sm:text-[16px]">
          {ticket.title}
        </h3>
        {ticket.venue ? (
          <p className="mt-1.5 truncate text-[11px] font-medium leading-[1.2] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.35)] sm:text-[12px]">
            {ticket.venue}
          </p>
        ) : null}
        {ticket.address ? (
          <p className="mt-1 min-w-0 text-[10px] leading-[1.2] text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,.4)] sm:text-[11px]">
            <span className="block truncate">{ticket.address}</span>
          </p>
        ) : null}
      </div>

      <div className="relative flex w-[68px] shrink-0 items-center justify-center border-l border-dashed border-white/80 bg-black/10 sm:w-[78px]">
        {ticket.price?.kind === "free" ? (
          <span className="rotate-180 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.5)] [writing-mode:vertical-rl]">
            Бесплатно
          </span>
        ) : ticket.price?.kind === "paid" ? (
          <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]">
            {ticket.price.isFrom ? (
              <span className="text-[12px] font-medium leading-none">от</span>
            ) : null}
            <span className="inline-flex items-end justify-center gap-[3px] whitespace-nowrap leading-none">
              <span className={
                ticket.price.amount.length <= 2 ? "text-[26px] font-semibold tracking-tight" :
                ticket.price.amount.length <= 4 ? "text-[20px] font-semibold tracking-tight" :
                "text-[14px] font-semibold tracking-tight"
              }>{ticket.price.amount}</span>
              <span className="mb-[2px] text-[12px] leading-none">
                <BelarusianRubleIcon size="default" />
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
