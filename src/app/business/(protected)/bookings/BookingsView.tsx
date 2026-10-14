"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookingsInbox } from "@/components/business/bookings/inbox/BookingsInbox";
import { isLegacyCalendarView } from "@/lib/business/bookingsInbox";
import { cn } from "@/lib/utils";
import { BookingsPageClient } from "./BookingsPageClient";

/**
 * Единый вход: по умолчанию — входящие (?tab=&kind=), календарь доступен по ?view=calendar.
 * Старые ссылки с ?status=, ?date=, ?id=, ?sort= продолжают открывать календарь.
 */
export function BookingsView() {
  const searchParams = useSearchParams();
  const calendar = isLegacyCalendarView(searchParams);

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition",
      active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100",
    );

  return (
    <div className="space-y-4">
      <nav aria-label="Вид списка" className="flex gap-1 rounded-full border border-stone-200 bg-white p-1 w-fit">
        <Link href="?tab=action&kind=all" className={tabClass(!calendar)} aria-current={!calendar ? "page" : undefined}>
          Входящие
        </Link>
        <Link href="?view=calendar" className={tabClass(calendar)} aria-current={calendar ? "page" : undefined}>
          Календарь
        </Link>
      </nav>
      {calendar ? <BookingsPageClient /> : <BookingsInbox />}
    </div>
  );
}
