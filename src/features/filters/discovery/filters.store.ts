import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname, ReadonlyURLSearchParams } from 'next/navigation';

export type DiscoveryFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  age: string[];
  metro: string[];
  district: string | null;
};

export const defaultFilters: DiscoveryFilters = {
  dateFrom: null,
  dateTo: null,
  age: [],
  metro: [],
  district: null,
};

export type OpenKey = "date" | "age" | "metro" | "district" | null;

// --- Utilities ---

export function parseAppliedFromUrl(searchParams: ReadonlyURLSearchParams): DiscoveryFilters {
  const dateFrom = searchParams.get("from") || searchParams.get("dateFrom") || searchParams.get("when"); // Fallback for old 'when' if any
  // Wait, old implementation used 'when' param with comma for ranges.
  // New spec: "from" param (or "dateFrom"), "to" param (or "dateTo")
  // Let's support both for transition if needed, but stick to spec.
  // But wait, the previous code was using 'when' with comma separated range.
  // Let's stick to the spec: "from", "to". 
  // But to be safe with existing links, let's also check 'when'.
  let dFrom = searchParams.get("from") || searchParams.get("dateFrom");
  let dTo = searchParams.get("to") || searchParams.get("dateTo");

  if (!dFrom && !dTo) {
      const w = searchParams.get("when");
      if (w) {
          if (w.includes(",")) {
              const parts = w.split(",");
              dFrom = parts[0];
              dTo = parts[1];
          } else {
              dFrom = w;
          }
      }
  }

  const age = searchParams.get("age")?.split(",").filter(Boolean) || [];
  const metro = searchParams.get("metro")?.split(",").filter(Boolean) || [];
  const district = searchParams.get("district") || null;

  return {
    dateFrom: dFrom || null,
    dateTo: dTo || null,
    age,
    metro,
    district,
  };
}

function writeAppliedToUrl(
  router: any,
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  next: DiscoveryFilters,
  mode: "replace" | "push" = "replace"
) {
  const params = new URLSearchParams(searchParams.toString());

  // Date
  if (next.dateFrom) params.set("from", next.dateFrom); else params.delete("from");
  if (next.dateTo) params.set("to", next.dateTo); else params.delete("to");
  // Clean up old 'when' if it exists
  params.delete("when");
  params.delete("dateFrom"); // ensure we use 'from' consistently or stick to one. Spec said "from" or "dateFrom". Let's use "from".
  params.delete("dateTo");

  // Age
  if (next.age.length > 0) params.set("age", next.age.join(","));
  else params.delete("age");

  // Metro
  if (next.metro.length > 0) params.set("metro", next.metro.join(","));
  else params.delete("metro");

  // District
  if (next.district) params.set("district", next.district);
  else params.delete("district");

  const queryString = params.toString();
  const url = queryString ? `${pathname}?${queryString}` : pathname;

  if (mode === "push") router.push(url, { scroll: false });
  else router.replace(url, { scroll: false });
}

// --- Hook ---

export function useDiscoveryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Applied state (Derived from URL)
  const applied = useMemo(() => parseAppliedFromUrl(searchParams), [searchParams]);

  // 2. Draft state (Local)
  const [draft, setDraftState] = useState<DiscoveryFilters>(applied);
  const [openKey, setOpenKey] = useState<OpenKey>(null);

  // Initialize draft from applied when opening a specific key
  // Or just whenever applied changes? No, draft should be stable while editing.
  // But if we close without applying, we want draft to reset.
  // We'll handle that in `beginDraft` or `close`.
  
  const beginDraft = useCallback((key: OpenKey) => {
    // Reset draft to current applied state before opening
    setDraftState(applied);
    setOpenKey(key);
  }, [applied]);

  const setDraft = useCallback((patch: Partial<DiscoveryFilters>) => {
    setDraftState(prev => ({ ...prev, ...patch }));
  }, []);

  const actions = useMemo(() => ({
    apply: () => {
      writeAppliedToUrl(router, pathname, searchParams, draft, "replace");
      setOpenKey(null);
    },
    resetAll: () => {
      // Clear all
      writeAppliedToUrl(router, pathname, searchParams, defaultFilters, "replace");
      setDraftState(defaultFilters);
      setOpenKey(null);
    },
    resetKey: (key: keyof DiscoveryFilters) => {
        // This resets specific key in URL immediately? 
        // Or in draft? Spec says: "clears only those params in URL, updates draft accordingly"
        // So immediate effect.
        const next = { ...applied, [key]: defaultFilters[key] };
        // Special case for date (it has two keys in our object but logically one group)
        if (key === 'dateFrom' || key === 'dateTo') {
            next.dateFrom = null;
            next.dateTo = null;
        }
        
        writeAppliedToUrl(router, pathname, searchParams, next, "replace");
        // Update draft to match
        setDraftState(prev => {
            const newDraft = { ...prev };
            if (key === 'dateFrom' || key === 'dateTo') {
                newDraft.dateFrom = null;
                newDraft.dateTo = null;
            } else {
                 // @ts-ignore
                newDraft[key] = defaultFilters[key];
            }
            return newDraft;
        });
    },
    close: () => {
      setOpenKey(null);
      setDraftState(applied); // Revert draft
    }
  }), [router, pathname, searchParams, draft, applied]);

  const derived = useMemo(() => {
    // We use DRAFT for dirty check if open? Or applied?
    // Usually dirty check is "is current state different from default".
    // If we are in draft mode (UI open), we might want to show draft state?
    // But usually "active filters" badge counts APPLIED filters.
    // The spec says "applied: derived from URL".
    // So derived values should be based on APPLIED mostly for the "Filter Bar".
    // But inside the sheet, we use draft.
    // Let's compute derived from APPLIED for the main bar usage.
    
    const filters = applied;
    
    const isDirty =
      !!filters.dateFrom ||
      !!filters.dateTo ||
      filters.age.length > 0 ||
      filters.metro.length > 0 ||
      !!filters.district;

    const activeCount =
      (filters.dateFrom || filters.dateTo ? 1 : 0) +
      (filters.age.length > 0 ? 1 : 0) +
      (filters.metro.length > 0 ? 1 : 0) +
      (filters.district ? 1 : 0);

    const dateLabel = filters.dateFrom
      ? filters.dateTo
        ? `${new Date(filters.dateFrom).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${new Date(filters.dateTo).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
        : new Date(filters.dateFrom).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      : "Когда идём";

    const ageLabel = filters.age.length > 0 
      ? filters.age.length === 1 ? filters.age[0] : `Возраст: ${filters.age.length}`
      : "Возраст";

    const metroLabel = filters.metro.length > 0
      ? filters.metro.length === 1 ? filters.metro[0] : `Метро: ${filters.metro.length}`
      : "Метро";

    const districtLabel = filters.district || "Район";

    return {
      isDirty,
      activeCount,
      labels: {
        dateLabel,
        ageLabel,
        metroLabel,
        districtLabel,
      },
    };
  }, [applied]);

  return {
    applied,
    draft,
    openKey,
    setOpenKey, // Low level setter if needed, but beginDraft is better
    beginDraft,
    setDraft,
    actions,
    derived
  };
}
