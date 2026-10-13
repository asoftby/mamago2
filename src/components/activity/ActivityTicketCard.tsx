"use client";

import * as React from "react";

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
      className="relative isolate flex min-h-[112px] w-full min-w-0 overflow-hidden rounded-[20px] bg-[#726d65] text-white shadow-[0_12px_30px_rgba(20,18,16,0.18)]"
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

      <div className="absolute -left-2.5 top-1/2 z-20 h-5 w-5 -translate-y-1/2 rounded-full bg-white" aria-hidden />
      <div className="absolute -right-2.5 top-1/2 z-20 h-5 w-5 -translate-y-1/2 rounded-full bg-white" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col justify-center py-4 pl-5 pr-3 sm:pl-6 sm:pr-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.2] tracking-[-0.015em] drop-shadow-[0_1px_2px_rgba(0,0,0,.35)] sm:text-[16px]">
          {ticket.title}
        </h3>
        {ticket.venue ? (
          <p className="mt-2 truncate text-[11px] font-medium leading-[1.2] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.35)] sm:text-[12px]">
            {ticket.venue}
          </p>
        ) : null}
        {ticket.address ? (
          <p className="mt-1 min-w-0 text-[10px] leading-[1.2] text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,.4)] sm:text-[11px]">
            <span className="block truncate">{ticket.address}</span>
          </p>
        ) : null}
      </div>

      <div className="relative flex w-[58px] shrink-0 items-center justify-center border-l border-dashed border-white/75 bg-black/10 sm:w-[64px]">
        {ticket.price?.kind === "free" ? (
          <span className="rotate-180 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.5)] [writing-mode:vertical-rl]">
            Бесплатно
          </span>
        ) : ticket.price ? (
          <span className="px-1.5 text-center text-[11px] font-semibold leading-[1.15] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.5)] sm:text-[12px]">
            {ticket.price.label}
          </span>
        ) : null}
      </div>
    </article>
  );
}
