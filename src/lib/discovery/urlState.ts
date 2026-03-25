// src/lib/discovery/urlState.ts

import { ReadonlyURLSearchParams } from "next/navigation";
import { DEFAULT_INTENT } from "@/server/discovery/intentConfig";

export type DiscoveryState = {
  intent: string;
  filters: Record<string, string[]>; // key -> array of values (for multi)
};

/**
 * Парсит URL searchParams в состояние.
 * Ключи фильтров берутся из params, исключая 'intent'.
 * Значения могут быть разделены запятыми (CSV) для мульти-выбора.
 */
export function parseDiscoveryState(
  searchParams: ReadonlyURLSearchParams | { [key: string]: string | string[] | undefined }
): DiscoveryState {
  const params = new URLSearchParams();
  
  if (searchParams instanceof ReadonlyURLSearchParams) {
    searchParams.forEach((value, key) => params.append(key, value));
  } else {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else if (value) {
        params.append(key, value);
      }
    });
  }

  const intent = params.get("intent") || DEFAULT_INTENT;
  const filters: Record<string, string[]> = {};

  params.forEach((value, key) => {
    if (key === "intent") return;
    
    // Поддержка CSV (например: activity_type=calm,active)
    const values = value.split(",").map(v => v.trim()).filter(Boolean);
    if (values.length > 0) {
        if (!filters[key]) {
            filters[key] = [];
        }
        filters[key].push(...values);
    }
  });

  return { intent, filters };
}

/**
 * Сериализует состояние обратно в queryString.
 */
export function serializeDiscoveryState(state: DiscoveryState): string {
  const params = new URLSearchParams();
  
  if (state.intent && state.intent !== DEFAULT_INTENT) {
    params.set("intent", state.intent);
  }

  Object.entries(state.filters).forEach(([key, values]) => {
    if (values && values.length > 0) {
      params.set(key, values.join(","));
    }
  });

  const str = params.toString();
  return str ? `?${str}` : "";
}
