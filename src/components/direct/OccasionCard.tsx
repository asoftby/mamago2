import { forwardRef } from "react";
import type { DirectThreadStatus } from "@prisma/client";
import { ThreadNumber } from "./ThreadNumber";
import styles from "./direct.module.css";

function occasionStatusLabel(status: DirectThreadStatus): string {
  switch (status) {
    case "BLOCKED":
      return "Заблокирован";
    case "ARCHIVED":
      return "Архив";
    case "CLOSED":
      return "Завершена";
    default:
      return "В работе";
  }
}

function formatOccasionDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export interface OccasionCardProps {
  emoji: string;
  publicationTitle: string;
  threadNumber: number;
  status: DirectThreadStatus;
  createdAt: Date | string;
  highlighted?: boolean;
}

/**
 * Shared "Повод обращения" header block — separates one publication/request
 * from another inside a single merged conversation. Forwards a ref so the
 * quick "Поводы" nav can scrollIntoView() a specific occasion.
 */
export const OccasionCard = forwardRef<HTMLDivElement, OccasionCardProps>(function OccasionCard(
  { emoji, publicationTitle, threadNumber, status, createdAt, highlighted },
  ref,
) {
  return (
    <div
      ref={ref}
      className={styles.occasionBlock}
      style={highlighted ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}
    >
      <span className={styles.occasionEmoji} aria-hidden>{emoji}</span>
      <div className={styles.occasionBody}>
        <div className={styles.occasionKicker}>Повод обращения</div>
        <div className={styles.occasionTitle}>{publicationTitle}</div>
        <div className={styles.occasionMeta}>
          <ThreadNumber value={threadNumber} />
          <span>·</span>
          <span>{occasionStatusLabel(status)}</span>
        </div>
      </div>
      <span className={styles.occasionDate}>{formatOccasionDate(createdAt)}</span>
    </div>
  );
});
