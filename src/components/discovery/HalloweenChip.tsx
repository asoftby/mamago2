"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./HalloweenChip.module.css";

type HalloweenChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active?: boolean;
  black?: boolean;
};

/** Seasonal quick-filter presentation. Filtering is owned by the parent. */
export function HalloweenChip({ active = false, black = false, className, ...props }: HalloweenChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(styles.chip, active && styles.active, black && styles.black, className)}
      {...props}
    >
      <svg className={styles.pumpkin} viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <path fill="#63804a" d="M15 7c-.2-3 1.1-5 4-5-.5 2-1.5 3.4-3 4.5l1.5 2-2.2 1.2z" />
        <path fill="#e8834a" d="M16 8C8.9 3.8 2.5 9.4 3 18.4 3.4 25.6 9.1 30 16 29c6.9 1 12.6-3.4 13-10.6C29.5 9.4 23.1 3.8 16 8z" />
        <path fill="#f6a257" d="M14 8C10 10 9 15 9.5 20.5c.3 4 2 7 4.5 8.3M18 8c4 2 5 7 4.5 12.5-.3 4-2 7-4.5 8.3" stroke="#d77b45" strokeWidth="1" />
        <path className={styles.face} d="m7 17 4-5 2 6zm12 1 2-6 4 5zm-9 3c4 3 8 3 12 0l-2 4-3-1-2 2-3-2z" />
        <path className={styles.glow} d="m7 17 4-5 2 6zm12 1 2-6 4 5zm-9 4c4 3 8 3 12 0l-2 3-3-1-2 2-3-2z" />
      </svg>
      <span>Хэллоуин</span>
      <svg className={styles.bat} viewBox="0 0 24 14" aria-hidden="true">
        <path d="M12 5 9 2 7 6C4 2 1 3 0 1c0 7 4 7 7 9l5 4 5-4c3-2 7-2 7-9-1 2-4 1-7 5l-2-4z" />
      </svg>
    </button>
  );
}
