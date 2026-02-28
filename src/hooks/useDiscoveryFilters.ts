"use client";

import { useEffect, useState } from "react";

export type FilterOption = { id: string; label: string; value: string; order: number };
export type FilterDef = { id: string; slug: string; title: string; type: "single" | "multi"; ui: string; options: FilterOption[] };

export function useDiscoveryFilters() {
  const [filters, setFilters] = useState<FilterDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/discovery/filters", { cache: "no-store" });
        const ct = res.headers.get("content-type") || "";
        
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0,200)}`);
        }
        
        if (!ct.includes("application/json")) {
           const text = await res.text();
           throw new Error(`Non-JSON response: ${text.slice(0,200)}`);
        }

        const data = await res.json();
        setFilters(data.filters ?? []);
      } catch (e: any) {
        console.error("Failed to fetch discovery filters:", e);
        setError(e?.message ?? String(e));
        setFilters([]);
      }
    })();
  }, []);

  return { filters, error, isLoading: filters === null };
}
