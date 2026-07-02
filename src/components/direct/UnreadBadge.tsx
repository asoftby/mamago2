import styles from "./direct.module.css";

/** Shared unread-count pill — list cards and (later) nav badges. */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className={styles.unreadBadge}>{count}</span>;
}
