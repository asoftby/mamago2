"use client";

import { useEffect, useState } from "react";

export type SavedPlanFilters = {
  include: string[];
  exclude: string[];
  visibility: "ALL" | "PRIVATE" | "FAMILY";
};
const DEFAULT: SavedPlanFilters = { include: [], exclude: [], visibility: "ALL" };
const keyFor = (userId: string) => `mamago.plan.audience.v1:${userId}`;
const eventName = "mamago:plan-audience-filter";
function parse(raw: string | null): SavedPlanFilters {
  if (!raw) return DEFAULT;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return DEFAULT;
    const obj = value as Record<string, unknown>;
    const ids = (key: "include" | "exclude") => Array.isArray(obj[key])
      ? [...new Set((obj[key] as unknown[]).filter((id): id is string => typeof id === "string" && /^(adult|child):[^:]+$/.test(id)))].slice(0, 50)
      : [];
    return { include: ids("include"), exclude: ids("exclude"), visibility: obj.visibility === "PRIVATE" || obj.visibility === "FAMILY" ? obj.visibility : "ALL" };
  } catch { return DEFAULT; }
}
/** Persist UI preferences only. Never use this to authorize access to plan records. */
export function useSharedPlanAudienceFilters(userId?: string | null) {
  const [filters, setFilters] = useState<SavedPlanFilters>(DEFAULT);
  useEffect(() => {
    if (!userId) { setFilters(DEFAULT); return; }
    const sync = () => { try { setFilters(parse(window.localStorage.getItem(keyFor(userId)))); } catch { setFilters(DEFAULT); } };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(eventName, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(eventName, sync); };
  }, [userId]);
  const update = (next: SavedPlanFilters) => {
    if (!userId) return;
    const sanitized = parse(JSON.stringify(next));
    setFilters(sanitized);
    try {
      window.localStorage.setItem(keyFor(userId), JSON.stringify(sanitized));
      window.dispatchEvent(new Event(eventName));
    } catch { /* browser privacy mode */ }
  };
  return { filters, update };
}
