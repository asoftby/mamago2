"use client";

import Link from "next/link";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import type { ParentBookingsResult } from "@/server/services/booking/parentBookings.service";
import { ParentBookingCard } from "./ParentBookingCard";

interface Props {
  bookings: ParentBookingsResult;
}

export function ParentBookingsClient({ bookings }: Props) {
  const { active, completed, cancelled } = bookings;
  const total = active.length + completed.length + cancelled.length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/me"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Мои записи
          </h1>
          {total > 0 && (
            <p className="text-sm text-neutral-400 mt-0.5">
              {total} {pluralBookings(total)}
            </p>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {total === 0 && <EmptyState />}

      {/* ── Active / Upcoming ── */}
      {active.length > 0 && (
        <section>
          <SectionTitle>Активные</SectionTitle>
          <div className="space-y-3">
            {active.map((b) => (
              <ParentBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      {/* ── Completed ── */}
      {completed.length > 0 && (
        <section>
          <SectionTitle>Завершённые</SectionTitle>
          <div className="space-y-3">
            {completed.map((b) => (
              <ParentBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      {/* ── Cancelled ── */}
      {cancelled.length > 0 && (
        <section>
          <SectionTitle muted>Отменённые</SectionTitle>
          <div className="space-y-3">
            {cancelled.map((b) => (
              <ParentBookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <h2
      className={cn(
        "mb-3 text-[13px] font-semibold uppercase tracking-widest",
        muted ? "text-neutral-300" : "text-neutral-400",
      )}
    >
      {children}
    </h2>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4ee]">
        <Sparkles className="h-7 w-7 text-[#EF8759]" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-neutral-900">
          Здесь будут ваши записи
        </p>
        <p className="max-w-xs text-sm text-neutral-400 leading-relaxed">
          Когда вы запишетесь на занятие, лагерь или мероприятие — всё появится здесь.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/search" className={peachPrimaryCtaLinkClassName()}>
          <Search className="h-4 w-4" />
          Найти занятия
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-[13px] font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 sm:px-[22px] sm:py-[13px] sm:text-[14px]"
        >
          Куда пойти
        </Link>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralBookings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "записи";
  return "записей";
}
