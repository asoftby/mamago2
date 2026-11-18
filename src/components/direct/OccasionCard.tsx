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

export interface OccasionCardProps {
  emoji: string;
  publicationTitle: string;
  threadNumber: number;
  status: DirectThreadStatus;
  highlighted?: boolean;
}

/**
 * Shared "Повод обращения" header block — separates one publication/request
 * from another inside a single merged conversation. Forwards a ref so the
 * quick "Поводы" nav can scrollIntoView() a specific occasion.
 */
export const OccasionCard = forwardRef<HTMLDivElement, OccasionCardProps>(function OccasionCard(
  { emoji, publicationTitle, threadNumber, status, highlighted },
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
    </div>
  );
});
