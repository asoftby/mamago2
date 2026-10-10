import type { CSSProperties } from "react";

/**
 * Токены дизайна «Мой план v3». Заданы на обёртке, чтобы не менять глобальную тему;
 * --plan-* переопределяют цвета общего календаря (features/plan-calendar) только внутри виджета.
 * Шрифты намеренно не задаём — используются шрифты проекта.
 */
export const MY_PLAN_V3_TOKENS = {
  "--mp-bg": "#F6F3EF",
  "--mp-card": "#FFFFFF",
  "--mp-line": "#ECE7E1",
  "--mp-line-strong": "#DCD4CB",
  "--mp-ac": "var(--primary)",
  "--mp-ac-dark": "var(--primary)",
  "--mp-ac-soft": "var(--brand-soft)",
  "--mp-tx": "#1D1B19",
  "--mp-tx2": "#5F5A55",
  "--mp-soft": "#EFEAE4",
  "--plan-ink": "#1D1B19",
  "--plan-surface": "#FFFFFF",
  "--plan-cell": "#F6F3EF",
  "--plan-line": "#ECE7E1",
  "--plan-muted": "#5F5A55",
  "--plan-faint": "#8A847E",
  "--plan-accent": "var(--primary)",
  "--plan-accent-ink": "var(--primary)",
  "--plan-on-ink": "#FFFFFF",
} as CSSProperties;
