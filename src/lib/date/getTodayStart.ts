/**
 * Returns today's date with time set to 00:00:00.000
 * Used for date comparisons to disable past dates in date pickers
 */
export function getTodayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
