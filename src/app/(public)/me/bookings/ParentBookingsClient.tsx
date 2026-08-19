"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ParentBookingsResult, ParentBookingItem } from "@/server/services/booking/parentBookings.service";
import { Reveal } from "./components/Reveal";
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
    <div className={styles.page}>
      {/* Breadcrumbs */}
      <div className={`${styles.wrap} ${styles.breadcrumbs}`}>
        <Link href="/me">← Профиль</Link>
        <span style={{ opacity: 0.5 }}>→</span>
        <span style={{ color: "var(--ink)" }}>Мои записи</span>
      </div>

      {/* Hero */}
      <section style={{ paddingTop: 20, paddingBottom: 36 }}>
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <Reveal>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <span className={styles.caps} style={{ color: "var(--accent-deep)" }}>
                ● Профиль · записи
              </span>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--ink-3)" }} />
              <span className={styles.caps}>Заявки и брони</span>
            </div>
            <h1 className={styles.heroTitle}>
              Мои{" "}
              <span className={styles.heroTitleAccent}>записи.</span>
            </h1>
            <p className={styles.heroLead}>
              Заявки на&nbsp;занятия, лагеря и&nbsp;мероприятия. Следите за&nbsp;статусом — мы&nbsp;напомним
              накануне каждой.
            </p>
          </Reveal>

          {total > 0 ? (
            <Reveal className={styles.heroSide}>
              <div className={styles.countCard}>
                <span className={styles.caps} style={{ color: "var(--accent-deep)" }}>
                  ● в записях
                </span>
                <div className={styles.serif} style={{ fontSize: 34, lineHeight: 1, letterSpacing: "-.02em" }}>
                  {total} {pluralBookings(total)}
                </div>
                <div
                  className={styles.mono}
                  style={{
                    fontSize: 11,
                    color: "var(--ink-3)",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  ● {counts.ACTIVE} активны · {counts.COMPLETED} завершены
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* Filters */}
      {total > 0 ? (
        <section className={styles.wrap} style={{ marginBottom: 24 }}>
          <Reveal className={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`${styles.pill} ${f.value === filter ? styles.pillSolid : ""}`.trim()}
              >
                {f.label}
                <span className={styles.count}>{String(counts[f.value]).padStart(2, "0")}</span>
              </button>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* List / Empty */}
      <section className={styles.wrap} style={{ paddingBottom: 80 }}>
        {visible.length > 0 ? (
          <div className={styles.recList}>
            {visible.map((b) => (
              <BookingRecordCard key={b.id} booking={b} />
            ))}
          </div>
        ) : (
          <EmptyState empty={total === 0} />
        )}
      </section>
    </div>
  );
}

function EmptyState({ empty }: { empty: boolean }) {
  return (
    <Reveal className={styles.empty}>
      <div className={styles.emptySpark}>
        <IcCalendar />
      </div>
      <h3 className={styles.emptyTitle}>
        {empty ? (
          <>
            Здесь будут{" "}
            <span className={styles.emptyTitleAccent}>ваши записи</span>
          </>
        ) : (
          <>
            В этой группе{" "}
            <span className={styles.emptyTitleAccent}>пока пусто</span>
          </>
        )}
      </h3>
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
    </Reveal>
  );
}
