/** Russia/Belarus-style month name → 0..11 */
const RUSSIAN_MONTH_GENITIVE: Record<string, number> = {
  января: 0,
  февраля: 1,
  марта: 2,
  апреля: 3,
  мая: 4,
  июня: 5,
  июля: 6,
  августа: 7,
  сентября: 8,
  октября: 9,
  ноября: 10,
  декабря: 11,
};

function resolveRussianMonth(token: string): number | undefined {
  const k = token.toLowerCase();
  if (RUSSIAN_MONTH_GENITIVE[k] !== undefined) return RUSSIAN_MONTH_GENITIVE[k];
  const entry = Object.keys(RUSSIAN_MONTH_GENITIVE).find(
    (m) => m.startsWith(k) || k.startsWith(m.slice(0, 4)),
  );
  return entry !== undefined ? RUSSIAN_MONTH_GENITIVE[entry] : undefined;
}

/**
 * «18 апреля 18:00» → ISO UTC (Минск фиксированно UTC+3, без DST).
 */
export function parseRussianDayMonthTimeToIsoMinsk(text: string): string | undefined {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i);
  if (!m) return undefined;
  const day = parseInt(m[1], 10);
  const month = resolveRussianMonth(m[2]);
  if (month === undefined) return undefined;
  const hour = parseInt(m[3], 10);
  const minute = parseInt(m[4], 10);
  const year = new Date().getFullYear();
  const hourUtc = hour - 3;
  return new Date(Date.UTC(year, month, day, hourUtc, minute, 0)).toISOString();
}
