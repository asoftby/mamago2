import type { ActivityFormat } from "@prisma/client";
import { MapPin, Monitor, RefreshCw } from "lucide-react";

export type ActivityFormatOption = {
  value: ActivityFormat;
  queryValue: "offline" | "online" | "hybrid";
  label: string;
  description: string;
  icon: typeof MapPin;
  detailLabel: string;
};

export const ACTIVITY_FORMAT_OPTIONS: ActivityFormatOption[] = [
  {
    value: "OFFLINE",
    queryValue: "offline",
    label: "Офлайн",
    description: "Нужно прийти на место",
    icon: MapPin,
    detailLabel: "В помещении",
  },
  {
    value: "ONLINE",
    queryValue: "online",
    label: "Онлайн",
    description: "Можно участвовать из дома",
    icon: Monitor,
    detailLabel: "Онлайн",
  },
  {
    value: "HYBRID",
    queryValue: "hybrid",
    label: "Онлайн + офлайн",
    description: "Можно участвовать онлайн или прийти на место",
    icon: RefreshCw,
    detailLabel: "Онлайн + офлайн",
  },
];

export const DEFAULT_ACTIVITY_FORMAT: ActivityFormat = "OFFLINE";

const ACTIVITY_FORMAT_BY_VALUE = new Map(
  ACTIVITY_FORMAT_OPTIONS.map((option) => [option.value, option]),
);

const ACTIVITY_FORMAT_BY_QUERY = new Map(
  ACTIVITY_FORMAT_OPTIONS.map((option) => [option.queryValue, option.value]),
);

export function getActivityFormatOption(
  value: ActivityFormat | null | undefined,
): ActivityFormatOption {
  return ACTIVITY_FORMAT_BY_VALUE.get(value ?? DEFAULT_ACTIVITY_FORMAT) ?? ACTIVITY_FORMAT_OPTIONS[0];
}

export function getActivityFormatLabel(value: ActivityFormat | null | undefined): string {
  return getActivityFormatOption(value).label;
}

export function getActivityFormatDetailLabel(
  value: ActivityFormat | null | undefined,
): string {
  return getActivityFormatOption(value).detailLabel;
}

export function parseActivityFormatQuery(
  value: string | null | undefined,
): ActivityFormat | null {
  if (!value) return null;
  return ACTIVITY_FORMAT_BY_QUERY.get(value.toLowerCase() as "offline" | "online" | "hybrid") ?? null;
}

export function serializeActivityFormatQuery(
  value: ActivityFormat | null | undefined,
): "offline" | "online" | "hybrid" | null {
  if (!value) return null;
  return getActivityFormatOption(value).queryValue;
}

export function normalizeActivityFormat(
  value: unknown,
  fallback: ActivityFormat = DEFAULT_ACTIVITY_FORMAT,
): ActivityFormat {
  if (typeof value !== "string") return fallback;
  const upper = value.toUpperCase();
  if (upper === "OFFLINE" || upper === "ONLINE" || upper === "HYBRID") {
    return upper;
  }
  return fallback;
}

