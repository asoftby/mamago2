"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import styles from "../bookings.module.css";

type RevealProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

/** Появление по скроллу — IntersectionObserver добавляет класс .in. */
export function Reveal({ as: Tag = "div", className = "", children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.in);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`${styles.reveal} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
