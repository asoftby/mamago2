import { z } from "zod";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const programmeEntriesSchema = z.array(z.object({
  itemId: z.string().min(1).max(128),
  from: clock.nullable(), to: clock.nullable(),
}).strict()).max(100).refine(rows => new Set(rows.map(row => row.itemId)).size === rows.length,
  "Услуга не должна повторяться");
export const programmeCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("programme"), version: z.number().int().nonnegative(),
    entries: programmeEntriesSchema }).strict(),
  z.object({ action: z.literal("participants"), version: z.number().int().nonnegative(),
    adultIds: z.array(z.string().min(1).max(128)).max(20),
    childIds: z.array(z.string().min(1).max(128)).max(30) }).strict(),
  z.object({ action: z.literal("publicLink"), version: z.number().int().nonnegative(),
    days: z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]) }).strict(),
  z.object({ action: z.literal("saveToPlan"), version: z.number().int().nonnegative() }).strict(),
]);
export type ProgrammeEntry = z.infer<typeof programmeEntriesSchema>[number];
export type ProgrammeCommand = z.infer<typeof programmeCommandSchema>;
export type ProgrammeRow = { id: string; title: string; from: string | null; to: string | null; status: string; timeConflict?: boolean };
export type ProgrammeView = { date: string | null; rows: ProgrammeRow[] };

export const programmeStatusLabels: Record<string, string> = {
  PLANNED: "Запланировано", REQUESTED: "Ожидает ответа", AGREEMENT: "Требуется согласование",
  CONFIRMED: "Подтверждено", DECLINED: "Отказ", REPLACE: "Нужна замена", CANCELLED: "Отменено",
};
const labels: Record<string, string> = { VENUE: "Площадка", ANIMATOR: "Анимационная программа",
  SHOW: "Шоу", MASTER_CLASS: "Мастер-класс", CAKE: "Торт", FOOD: "Угощение", DECOR: "Оформление",
  PHOTO: "Фотосъёмка", PROGRAM: "Программа", OTHER: "Дополнительная услуга" };
export type ProgrammeSource = {
  status: string; eventDate: Date | null; timeFrom: string | null; timeTo: string | null; programme: unknown;
  items: Array<{ id: string; category: string; role: string; parentItemId: string | null;
    status: string; position: number; packageComponentChange?: unknown; serviceStart: Date | null; serviceEnd: Date | null;
    requests: Array<{ partyStage: string | null; partyQuotes: Array<{ status: string; validUntil: Date | null }> }> }>;
};
const localTime = (value: Date | null) => value ? new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(value) : null;
export function programmeEntries(value: unknown): ProgrammeEntry[] {
  const parsed = programmeEntriesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
/** Redacted projection shared verbatim by the owner's preview and public/family readers.
 * No catalogue title, arbitrary text, child data, contacts, location, money or private IDs. */
export function projectProgramme(party: ProgrammeSource, now = new Date()): ProgrammeView {
  const overrides = programmeEntries(party.programme);
  const positions = new Map(overrides.map((row, index) => [row.itemId, index]));
  const byId = new Map(overrides.map(row => [row.itemId, row]));
  const itemsById = new Map(party.items.map(item => [item.id, item]));
  const sorted = [...party.items].sort((a, b) =>
    (positions.get(a.id) ?? overrides.length + a.position) - (positions.get(b.id) ?? overrides.length + b.position));
  return { date: party.eventDate?.toISOString().slice(0, 10) ?? null, rows: sorted.map((item, index) => {
    const parent = item.parentItemId ? itemsById.get(item.parentItemId) : null;
    const request = item.requests[0] ?? (item.role === "INCLUDED" ? parent?.requests[0] : null);
    const stage = request?.partyStage;
    const quote = request?.partyQuotes[0];
    const override = byId.get(item.id);
    const lower = localTime(item.serviceStart) ?? party.timeFrom;
    const upper = localTime(item.serviceEnd) ?? party.timeTo;
    const timeConflict = Boolean(override?.from && override.to &&
      ((lower && override.from < lower) || (upper && override.to > upper)));
    let status = item.status;
    if (party.status === "CANCELLED" || item.status === "CANCELLED") status = "CANCELLED";
    else if (item.role === "INCLUDED" && item.packageComponentChange) status = "AGREEMENT";
    else if (item.status === "CONFIRMED" || stage === "CONFIRMED") status = "CONFIRMED";
    else if (stage === "DECLINED") status = "DECLINED";
    else if (stage === "EXPIRED" || stage === "NOT_ACCEPTED" || item.status === "NEEDS_DECISION" || item.status === "EXPIRED") status = "REPLACE";
    else if (stage === "QUOTED") status = quote?.status === "ACTIVE" && quote.validUntil && quote.validUntil > now ? "AGREEMENT" : "REPLACE";
    else if (stage === "AWAITING_RECONFIRM") status = "AGREEMENT";
    else if (stage === "SENT") status = "REQUESTED";
    return { id: String(index + 1), title: labels[item.category] ?? "Услуга",
      from: (!timeConflict ? override?.from : null) ?? localTime(item.serviceStart) ?? (item.role === "ANCHOR" ? party.timeFrom : null),
      to: (!timeConflict ? override?.to : null) ?? localTime(item.serviceEnd) ?? (item.role === "ANCHOR" ? party.timeTo : null), status, ...(timeConflict ? { timeConflict: true } : {}) };
  }) };
}
type ProgrammeTimingSource = Pick<ProgrammeSource, "timeFrom" | "timeTo"> & {
  items: ReadonlyArray<Pick<ProgrammeSource["items"][number], "id" | "serviceStart" | "serviceEnd">>;
};
export function validateProgramme(entries: ProgrammeEntry[], party: ProgrammeTimingSource): string | null {
  const items = new Map(party.items.map(item => [item.id, item]));
  for (const entry of entries) {
    const item = items.get(entry.itemId);
    if (!item) return "Услуга больше не входит в заказ. Обновите страницу";
    if (Boolean(entry.from) !== Boolean(entry.to) || (entry.from && entry.to && entry.from >= entry.to))
      return "Укажите начало и окончание в пределах одного дня";
    const start = localTime(item.serviceStart) ?? party.timeFrom;
    const end = localTime(item.serviceEnd) ?? party.timeTo;
    if (entry.from && ((start && entry.from < start) || (end && entry.to! > end)))
      return "Время программы должно находиться внутри согласованного интервала услуги";
  }
  // Different providers can work simultaneously; programme edits never alter resource reservations.
  return null;
}
