export type WorkKind = "SALES" | "SERVICE" | "OPERATIONS";
export type WorkStatus = "NEW" | "IN_PROGRESS" | "WAITING" | "DONE" | "CANCELED";
export type WorkSalesStage = "FIRST_CONTACT" | "CONTACTED" | "OFFER_SENT" |
  "PAYMENT_PENDING" | "WON" | "LOST";

export interface WorkItem {
  id: string;
  title: string;
  kind: WorkKind;
  status: WorkStatus;
  salesStage: WorkSalesStage | null;
  nextAction: string | null;
  dueAt: string | null;
  updatedAt: string;
  assigneeId: string;
  leadId: string | null;
  businessId: string | null;
  business: { id: string; name: string } | null;
  lead: { id: string; name: string } | null;
}

export interface CrmLead {
  id: string;
  name: string;
  contactName: string | null;
  phoneE164: string | null;
  email: string | null;
  source: string | null;
  sourceUrl: string | null;
  businessId: string | null;
  createdAt: string;
  business: { id: string; name: string } | null;
}

interface Paginated {
  total: number;
  page: number;
  take: number;
}

export type WorkList = Paginated & { items: WorkItem[] };
export type LeadList = Paginated & { leads: CrmLead[] };

export function isOpen(item: WorkItem): boolean {
  return item.status !== "DONE" && item.status !== "CANCELED";
}

export function workStatusLabel(item: WorkItem): string {
  if (item.status === "WAITING") return "Ждём клиента";
  if (item.kind === "SALES") return "Продажа";
  if (item.kind === "SERVICE") return "Сервис";
  return "Дело";
}

export function workStatusColor(item: WorkItem): string {
  if (item.status === "WAITING") return "bg-amber-50 text-amber-800";
  if (item.kind === "SALES") return "bg-emerald-50 text-emerald-800";
  if (item.kind === "SERVICE") return "bg-sky-50 text-sky-800";
  return "bg-violet-50 text-violet-800";
}

export function sortByDeadline(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) =>
    (a.dueAt ? Date.parse(a.dueAt) : Infinity) -
    (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
    a.title.localeCompare(b.title, "ru")
  );
}

export function uniqueItems(...lists: WorkItem[][]): WorkItem[] {
  return Array.from(new Map(lists.flat().map(item => [item.id, item])).values());
}

export function minskDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const get = (type: "year" | "month" | "day") =>
    parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isUpcoming(item: WorkItem, now: Date): boolean {
  return isOpen(item) && item.dueAt != null &&
    Date.parse(item.dueAt) > now.getTime() &&
    minskDateKey(new Date(item.dueAt)) > minskDateKey(now);
}

export function minskDateTime(value: string | Date, type: "time" | "full" = "time"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Minsk",
    ...(type === "full" ? { day: "numeric", month: "short" } : {}),
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function minskDateInput(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(now.getTime() + 60 * 60 * 1000));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function minskInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
