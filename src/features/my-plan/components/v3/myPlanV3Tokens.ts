import type { CSSProperties } from "react";

/**
 * Токены дизайна «Мой план v3» — алиасы токенов дизайн-системы (globals.css), без хардкода цветов и шрифтов.
 * Заданы на обёртке, чтобы не менять глобальную тему;
 * --plan-* переопределяют цвета общего календаря (features/plan-calendar) только внутри виджета.
 * Типографика: засечки (display) — только для смысла и атмосферы (заголовок модалки, крупные цифры дат);
 * гротеск (ui) — всё интерактивное; mono (meta) — месяц/год и дни недели. Классы: mp-font-display /
 * mp-font-ui / mp-font-meta (globals.css) читают эти токены.
 */
export const MY_PLAN_V3_TOKENS = {
  "--mp-bg": "var(--surface-subtle)",
  "--mp-card": "var(--surface)",
  "--mp-line": "var(--border)",
  "--mp-line-strong": "var(--border-strong)",
  "--mp-ac": "var(--primary)",
  "--mp-ac-dark": "var(--brand-active)",
  "--mp-ac-soft": "var(--brand-soft)",
  "--mp-tx": "var(--text-main)",
  "--mp-tx2": "var(--text-muted)",
  "--mp-soft": "var(--surface-hover)",
  "--mp-font-display": "var(--font-display)",
  "--mp-font-ui": "var(--font-sans)",
  "--mp-font-meta": "var(--font-mono)",
  /** Выбранный чип: тёмный фон, белый текст. Оранжевый — только primary-кнопка и акценты. */
  "--mp-chip-on-bg": "var(--text-main)",
  "--mp-chip-on-tx": "var(--surface)",
  "--mp-chip-line": "var(--border-strong)",
  "--plan-ink": "var(--text-main)",
  "--plan-surface": "var(--surface)",
  "--plan-cell": "var(--surface-subtle)",
  "--plan-line": "var(--border)",
  "--plan-muted": "var(--text-muted)",
  "--plan-faint": "var(--text-subtle)",
  "--plan-accent": "var(--primary)",
  "--plan-accent-ink": "var(--brand-active)",
  "--plan-on-ink": "var(--surface)",
} as CSSProperties;
