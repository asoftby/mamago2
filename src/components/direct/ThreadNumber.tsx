import { formatDirectThreadNumber } from "@/lib/direct/threadNumber";
import styles from "./direct.module.css";

/** Shared "D-10253" renderer — one place to change the display format everywhere. */
export function ThreadNumber({ value, className }: { value: number; className?: string }) {
  return <span className={className ?? styles.mono}>{formatDirectThreadNumber(value)}</span>;
}
