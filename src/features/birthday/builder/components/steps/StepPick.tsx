"use client";

import Link from "next/link";

/**
 * PR 1: the old prototype catalog was removed. Until PR 2 connects verified,
 * published offers, show an honest empty state and do not allow submission.
 */
export function StepPick({ citySlug }: { citySlug: string }) {
  return (
    <section style={{ maxWidth: 760, margin: "48px auto", textAlign: "center" }}
      aria-label="Подбор праздничных услуг">
      <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".12em", color: "#9B5134" }}>
        Подбор праздничных услуг
      </span>
      <h2 style={{ fontSize: "clamp(28px,5vw,48px)", lineHeight: 1.15, margin: "18px 0 12px" }}>
        Каталог праздников обновляется
      </h2>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "#61584F", margin: "0 auto", maxWidth: 560 }}>
        Сейчас мы подключаем реальные предложения организаторов.
        Пока в конструкторе нельзя выбрать услугу или отправить заявку.
        Никаких бронирований и подтверждений не создано.
      </p>
      <Link href={`/${citySlug}/birthday`} style={{ display: "inline-flex", marginTop: 24,
        padding: "12px 22px", borderRadius: 999, background: "#141210", color: "#fff", textDecoration: "none" }}>
        Посмотреть раздел праздников
      </Link>
    </section>
  );
}
