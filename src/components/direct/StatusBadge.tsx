import styles from "./direct.module.css";

export type DirectDisplayStatus = "ACTIVE" | "WAITING" | "COMPLETED" | "ARCHIVE" | "BLOCKED";

const LABELS: Record<DirectDisplayStatus, string> = {
  ACTIVE: "В работе",
  WAITING: "Ждём ответа",
  COMPLETED: "Завершена",
  ARCHIVE: "Архив",
  BLOCKED: "Заблокирован",
};

const CLASSES: Record<DirectDisplayStatus, string> = {
  ACTIVE: styles.statusOpen,
  WAITING: styles.statusWaiting,
  COMPLETED: styles.statusClosed,
  ARCHIVE: styles.statusArchived,
  BLOCKED: styles.statusBlocked,
};

/** Shared status pill — used on list cards and occasion header blocks alike. */
export function StatusBadge({ status }: { status: DirectDisplayStatus }) {
  return <span className={`${styles.statusPill} ${CLASSES[status]}`}>{LABELS[status]}</span>;
}
