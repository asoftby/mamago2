const WEEKDAY_ACCUSATIVE_RU = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среду",
  "четверг",
  "пятницу",
  "субботу",
] as const;

/**
 * Formats a plan target date for copy that follows the preposition "на":
 * "на субботу, 26 сентября".
 *
 * Intl.DateTimeFormat returns Russian weekdays in nominative case
 * ("суббота"), so the weekday is inflected explicitly here.
 */
export function formatPlanTargetDateRu(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = WEEKDAY_ACCUSATIVE_RU[date.getDay()]!;
  const dayMonth = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  return `${weekday}, ${dayMonth}`;
}
