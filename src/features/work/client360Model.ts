import type { SubscriptionStatus } from "@prisma/client";
import { BUSINESS_VERIFICATION_STATUS_LABELS_RU, SUBSCRIPTION_STATUS_LABELS_RU } from "@/lib/admin/labels.ru";
import { adminPath } from "@/lib/routing/surface";

export type ClientFilter = "all" | "approved" | "pending" | "disabled";
export const CLIENT_FILTERS: { value: ClientFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "approved", label: "Подтверждённые" },
  { value: "pending", label: "Нужна проверка" },
  { value: "disabled", label: "Отключённые" },
];

export const VERIFICATION_LABELS = BUSINESS_VERIFICATION_STATUS_LABELS_RU;
export const SUBSCRIPTION_LABELS = SUBSCRIPTION_STATUS_LABELS_RU;

export function parseClientFilter(input?: string): ClientFilter {
  return CLIENT_FILTERS.find((item) => item.value === input)?.value ?? "all";
}

export function parseClientPage(input?: string): number {
  const page = Number(input);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
}

export function isCurrentSubscription(
  status: SubscriptionStatus,
  end: Date,
  now: Date,
): boolean {
  return (status === "ACTIVE" || status === "TRIALING") && end.getTime() > now.getTime();
}

export function crmClientPath(id: string): string {
  return adminPath("/work/clients/" + encodeURIComponent(id));
}

export function crmClientsHref(input: { filter: ClientFilter; search: string; page: number }): string {
  const params = new URLSearchParams();
  if (input.filter !== "all") params.set("status", input.filter);
  if (input.search) params.set("q", input.search);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return adminPath("/work/clients") + (query ? "?" + query : "");
}
