const TZ = "Europe/Minsk";

export function formatInboxDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: TZ });
}

export function formatInboxDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

export function formatInboxSchedule(item: { requestedDate: string | null; requestedTime: string | null; serviceEndsAt: string | null }): string {
  const date = formatInboxDate(item.requestedDate ?? item.serviceEndsAt);
  if (!date) return "Дата уточняется";
  return item.requestedTime ? `${date}, ${item.requestedTime}` : date;
}

/** Начало праздника для ограничения продления (минское время). */
export function partyEventStart(item: { requestedDate: string | null; requestedTime: string | null }): Date | null {
  if (!item.requestedDate || !item.requestedTime) return null;
  const d = new Date(`${item.requestedDate.slice(0, 10)}T${item.requestedTime}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Значение для <input type="datetime-local"> в локальной зоне браузера. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** «13 ноября в 15:30»: момент автоотмены заявки, null если срок прошёл или не задан. */
export function formatInboxAutoCancel(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= now.getTime()) return null;
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: TZ });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return `${date} в ${time}`;
}
