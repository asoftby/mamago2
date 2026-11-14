"use client";

import { useMemo, useState } from "react";
import { AccountPage } from "@/components/account/AccountPage";
import type { ParentBookingsResult, ParentBookingItem } from "@/server/services/booking/parentBookings.service";
import { IcCalendar } from "./components/icons";
import { BookingRecordCard } from "./components/BookingRecordCard";
import { BookingEmptyStateActions } from "./BookingEmptyStateActions";
import styles from "./bookings.module.css";

interface Props {
  bookings: ParentBookingsResult;
}

type Filter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "ACTIVE", label: "Активные" },
  { value: "COMPLETED", label: "Завершённые" },
  { value: "CANCELLED", label: "Отменённые" },
];

function pluralBookings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
}

export function ParentBookingsClient({ bookings }: Props) {
  const { active, completed, cancelled } = bookings;
  const [filter, setFilter] = useState<Filter>("ALL");

  const counts = useMemo(
    () => ({
      ALL: active.length + completed.length + cancelled.length,
      ACTIVE: active.length,
      COMPLETED: completed.length,
      CANCELLED: cancelled.length,
    }),
    [active.length, completed.length, cancelled.length],
  );

  const visible: ParentBookingItem[] = useMemo(() => {
    switch (filter) {
      case "ACTIVE":
        return active;
      case "COMPLETED":
        return completed;
      case "CANCELLED":
        return cancelled;
      default:
        return [...active, ...completed, ...cancelled];
    }
  }, [filter, active, completed, cancelled]);

  const total = counts.ALL;

  return (
    <AccountPage
      backHref="/me"
      title="Мои записи"
      lead={
        total > 0
          ? `Заявки на занятия, лагеря и мероприятия. Всего ${total} ${pluralBookings(total)}: ${counts.ACTIVE} активны, ${counts.COMPLETED} завершены. Мы напомним накануне каждой.`
          : "Заявки на занятия, лагеря и мероприятия. Следите за статусом — мы напомним накануне каждой."
      }
    >
      <div className={styles.page}>
        {total > 0 ? (
          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`${styles.pill} ${f.value === filter ? styles.pillSolid : ""}`.trim()}
              >
                {f.label}
                <span className={styles.count}>{counts[f.value]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {visible.length > 0 ? (
          <div className={styles.recList}>
            {visible.map((b) => (
              <BookingRecordCard key={b.id} booking={b} />
            ))}
          </div>
        ) : (
          <EmptyState empty={total === 0} />
        )}
      </div>
    </AccountPage>
  );
}

function EmptyState({ empty }: { empty: boolean }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptySpark}>
        <IcCalendar />
      </div>
      <h2 className={styles.emptyTitle}>
        {empty ? (
          <>
            Здесь будут ваши записи
          </>
        ) : (
          <>
            В этой группе пока пусто
          </>
        )}
      </h2>
      <p className={styles.emptyLead}>
        {empty
          ? "Когда вы запишетесь на занятие, лагерь или мероприятие — всё появится здесь."
          : "Записей с таким статусом нет. Загляните в другие вкладки или найдите новые занятия."}
      </p>
      <div className={styles.emptyActions}>
        <BookingEmptyStateActions
          classesButtonClassName={`${styles.btn} ${styles.btnAccent}`}
          kudaButtonClassName={`${styles.btn} ${styles.btnGhost}`}
        />
      </div>
    </div>
  );
}
