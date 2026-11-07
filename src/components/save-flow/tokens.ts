/**
 * Дизайн-токены save-flow («Сохранить» в план/идеи) и сценария дня.
 *
 * Значения вынесены из SaveToPlanModal БЕЗ изменений (визуально идентично).
 * `peach` / `peachLine` совпадают с `--mp-chip-on-bg` / `--mp-chip-on-line` из
 * `myPlanV3Tokens` (проверяется тестом). Остальные намеренно остаются hex-значениями:
 * они отличаются от глобальных CSS-переменных (например ink #141210 vs --text-main
 * #1A1410, accentDeep #C24E22 vs --brand-active #C85F35), и перевод на переменные
 * изменил бы внешний вид модалки.
 */
export const C = {
  bg: "#FFFFFF",
  paper: "#FAF7F1",
  ink: "#141210",
  /** Выбранное состояние как в «Моём плане»: персиковый фон, оранжевая обводка, тёмный текст. */
  peach: "#F7C3AD",
  peachLine: "#F3A684",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
  green: "#1F8A5B",
  greenBg: "rgba(31,138,91,.12)",
} as const;
