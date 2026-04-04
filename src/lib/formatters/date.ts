/**
 * Date Formatters
 * Deterministic date formatting for SSR + client hydration
 * 
 * CRITICAL: These formatters MUST produce identical output on server (Node.js) and client (browser)
 * to avoid React hydration mismatches.
 */

// Hardcoded month abbreviations to ensure consistency across all environments
const RU_MONTH_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."
];

/**
 * Format date as short Russian day + month (e.g., "4 мар.")
 * 
 * This formatter is 100% deterministic - uses hardcoded month names
 * instead of Intl.DateTimeFormat to avoid Node.js vs browser differences.
 * 
 * Examples:
 * - new Date("2024-03-04") → "4 мар."
 * - new Date("2024-12-25") → "25 дек."
 * 
 * @param date - Date object or ISO string
 * @returns Formatted string like "4 мар." or empty string if invalid
 */
export function formatRuShortDayMonth(date: Date | string): string {
  try {
    // Parse string to Date if needed
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return "";
    }

    const day = dateObj.getDate();
    const monthIndex = dateObj.getMonth();
    const monthShort = RU_MONTH_SHORT[monthIndex];

    return `${day} ${monthShort}`;
  } catch (error) {
    // Gracefully handle any errors
    console.error("formatRuShortDayMonth error:", error);
    return "";
  }
}

function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Одна дата или интервал: «4 апр.», «4–5 апр.», «4 апр.–5 мар.» (детерминированно, как formatRuShortDayMonth).
 */
export function formatRuShortDayMonthRange(
  start: Date | string,
  end?: Date | string | null,
): string {
  try {
    const s = typeof start === "string" ? new Date(start) : start;
    if (isNaN(s.getTime())) return "";
    if (end == null || end === "") return formatRuShortDayMonth(s);
    const e = typeof end === "string" ? new Date(end) : end;
    if (isNaN(e.getTime())) return formatRuShortDayMonth(s);
    if (sameLocalCalendarDay(s, e)) return formatRuShortDayMonth(s);
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      const monthShort = RU_MONTH_SHORT[s.getMonth()];
      return `${s.getDate()}–${e.getDate()} ${monthShort}`;
    }
    return `${formatRuShortDayMonth(s)}–${formatRuShortDayMonth(e)}`;
  } catch (error) {
    console.error("formatRuShortDayMonthRange error:", error);
    return formatRuShortDayMonth(start);
  }
}

/**
 * Dev-only validation helper
 * Ensures formatter produces expected output
 */
if (process.env.NODE_ENV === "development") {
  // Self-test on module load
  const testDate = new Date("2024-03-04T12:00:00Z");
  const result = formatRuShortDayMonth(testDate);
  
  // Expected format: "4 мар."
  if (!result.match(/^\d{1,2}\s[а-я]{3,4}\.?$/)) {
    console.warn(
      `[formatRuShortDayMonth] Unexpected format: "${result}". Expected pattern: "4 мар."`
    );
  }
}
