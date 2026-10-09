"use client";

import { forwardRef } from "react";
import {
  dayOfMonth,
  isPast as isPastKey,
  monthShort,
  weekdayShort,
  type DateKey,
} from "@/lib/date/dateKey";
import { dayAriaLabel } from "./lib/labels";
import { ownerColor } from "./lib/ownerColor";
import styles from "./plan-calendar.module.css";

type DayCellProps = {
  dateKey: DateKey;
  today: DateKey;
  selected: boolean;
  owners: readonly string[];
  variant: "desktop" | "mobile";
  tabIndex: 0 | -1;
  onSelect: (d: DateKey) => void;
};

const MAX_DOTS = 3;

/** One day: weekday label, number, up to three owner dots. Shared by every calendar mode. */
export const DayCell = forwardRef<HTMLButtonElement, DayCellProps>(function DayCell(
  { dateKey, today, selected, owners, variant, tabIndex, onSelect },
  ref,
) {
  const isToday = dateKey === today;
  const isPast = isPastKey(dateKey, today);
  const mobile = variant === "mobile";
  const firstOfMonth = mobile && dayOfMonth(dateKey) === 1;
  const className = [
    styles.cell,
    mobile ? styles.cellMobile : "",
    selected ? styles.selected : "",
    isToday ? styles.today : "",
    isPast ? styles.past : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={dayAriaLabel(dateKey, { today: isToday, count: owners.length })}
      aria-current={isToday ? "date" : undefined}
      tabIndex={tabIndex}
      data-day={dateKey}
      className={className}
      onClick={() => onSelect(dateKey)}
    >
      <span className={`${styles.dow} ${firstOfMonth ? styles.dowMonth : ""}`}>
        {firstOfMonth ? monthShort(dateKey) : weekdayShort(dateKey)}
      </span>
      <span className={styles.num}>{dayOfMonth(dateKey)}</span>
      <span className={styles.dots} aria-hidden>
        {owners.slice(0, MAX_DOTS).map((owner) => (
          <span
            key={owner}
            className={styles.dot}
            style={selected ? undefined : { background: ownerColor(owner) }}
          />
        ))}
      </span>
    </button>
  );
});
