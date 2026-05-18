"use client";

import { create } from "zustand";
import type { DiscoveryFiltersState, DiscoveryFilterKey } from "./filters.types";

type FilterValue = string | string[] | null;

type Actions = {
  setFilter: (key: DiscoveryFilterKey, value: FilterValue) => void;
  toggleMulti: (key: "age", value: string) => void;
  resetAll: () => void;
  hydrateFromSearchParams: (sp: URLSearchParams) => void;
  toSearchParams: () => URLSearchParams;
};

type Store = DiscoveryFiltersState & Actions;

const DEFAULTS: DiscoveryFiltersState = {
  when: null,
  age: [],
  districtId: null,
  metroId: null,
  dateFrom: null,
  dateTo: null,
};

const STORAGE_KEY = "mamago.discovery.filters.v1";

const safeWindow = typeof window !== "undefined" ? window : undefined;

function parseFromURL(sp: URLSearchParams): Partial<DiscoveryFiltersState> {
  const age = sp.get("age");
  return {
    when: sp.get("when"),
    age: age ? age.split(",") : [],
    districtId: sp.get("district") || null,
    metroId: sp.get("metro") || null,
    dateFrom: sp.get("from") || null,
    dateTo: sp.get("to") || null,
  };
}

function toURLParams(state: DiscoveryFiltersState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.when) sp.set("when", state.when);
  if (state.age.length > 0) sp.set("age", state.age.join(","));
  if (state.districtId) sp.set("district", state.districtId);
  if (state.metroId) sp.set("metro", state.metroId);
  if (state.dateFrom) sp.set("from", state.dateFrom);
  if (state.dateTo) sp.set("to", state.dateTo);
  return sp;
}

export const useDiscoveryFiltersStore = create<Store>((set, get) => ({
  ...DEFAULTS,
  setFilter: (key, value) => {
    set({ [key]: value } as Partial<DiscoveryFiltersState>);
    if (safeWindow) {
      const sp = toURLParams(get());
      const nextUrl = `${safeWindow.location.pathname}?${sp.toString()}`;
      safeWindow.history.replaceState(null, "", nextUrl);
      safeWindow.localStorage?.setItem(STORAGE_KEY, JSON.stringify(get()));
    }
  },
  toggleMulti: (key, value) => {
    const current = new Set(get()[key]);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    const next = Array.from(current);
    set({ [key]: next } as Partial<DiscoveryFiltersState>);
    if (safeWindow) {
      const sp = toURLParams(get());
      const nextUrl = `${safeWindow.location.pathname}?${sp.toString()}`;
      safeWindow.history.replaceState(null, "", nextUrl);
      safeWindow.localStorage?.setItem(STORAGE_KEY, JSON.stringify(get()));
    }
  },
  resetAll: () => {
    set({ ...DEFAULTS });
    if (safeWindow) {
      const nextUrl = `${safeWindow.location.pathname}`;
      safeWindow.history.replaceState(null, "", nextUrl);
      safeWindow.localStorage?.removeItem(STORAGE_KEY);
    }
  },
  hydrateFromSearchParams: (sp: URLSearchParams) => {
    const fromUrl = parseFromURL(sp);
    set({ ...DEFAULTS, ...fromUrl });
    if (safeWindow) {
      safeWindow.localStorage?.setItem(STORAGE_KEY, JSON.stringify(get()));
    }
  },
  toSearchParams: () => {
    return toURLParams(get());
  },
}));

/**
 * Hydration order (IMPORTANT for shared links):
 * 1. URL params (highest priority) — ensures shared links work correctly
 * 2. localStorage (fallback) — for returning users
 * 3. Defaults (base)
 *
 * This prevents the bug where localStorage overrides shared link filters.
 */
if (safeWindow) {
  try {
    // Always check URL params first — shared links must work
    const sp = new URLSearchParams(safeWindow.location.search);
    const hasUrlParams = Array.from(sp.keys()).length > 0;

    if (hasUrlParams) {
      // URL params take priority — hydrate from URL
      const fromUrl = parseFromURL(sp);
      useDiscoveryFiltersStore.setState({ ...DEFAULTS, ...fromUrl });
      // Sync to localStorage for next visit
      safeWindow.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify(useDiscoveryFiltersStore.getState())
      );
    } else {
      // No URL params — try localStorage
      const stored = safeWindow.localStorage?.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        useDiscoveryFiltersStore.setState({ ...DEFAULTS, ...parsed });
      }
      // If no localStorage either, defaults are already set
    }
  } catch {
    // ignore
  }
}

export function useDiscoveryFiltersURL() {
  const toSearchParams = useDiscoveryFiltersStore((s) => s.toSearchParams);
  return toSearchParams();
}
