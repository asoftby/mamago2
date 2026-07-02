import styles from "./direct.module.css";

export interface ConversationHeaderProps {
  counterpartyName: string;
  counterpartyLogoUrl: string | null;
  occasionCount: number;
  latestStatusLabel?: string;
}

function pluralOccasions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "обращение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "обращения";
  return "обращений";
}

/**
 * Shared top card for the conversation screen. Same component whether the
 * counterparty is a Business (customer viewing) or a customer (business
 * viewing) — only the name/logo passed in differ.
 */
export function ConversationHeader({
  counterpartyName,
  counterpartyLogoUrl,
  occasionCount,
  latestStatusLabel,
}: ConversationHeaderProps) {
  return (
    <div className={styles.topCard}>
      <div className={styles.brandAvatar} style={{ width: 48, height: 48 }}>
        {counterpartyLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={counterpartyLogoUrl} alt="" width={48} height={48} />
        ) : (
          counterpartyName.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className={styles.topCardBody}>
        <div className={styles.topCardTitle}>{counterpartyName}</div>
        <div className={styles.topCardBrandRow}>
          <span className={styles.mono}>
            {occasionCount} {pluralOccasions(occasionCount)}
          </span>
          {latestStatusLabel && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{latestStatusLabel}</span>
            </>
          )}
        </div>
        <div className={styles.topCardMeta}>
          {/* Placeholder — real responsiveness metrics land in a later phase. */}
          Обычно отвечает в течение дня
        </div>
      </div>
    </div>
  );
}
