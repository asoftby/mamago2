import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { FilterDef, AppliedState, FilterKey } from './types';
import { parseFromSearchParams, buildNextQuery } from './url';

interface UseFilterStateResult {
  applied: AppliedState;
  draft: AppliedState;
  openKey: FilterKey | null;
  setOpenKey: (key: FilterKey | null) => void;
  beginDraft: (key: FilterKey) => void;
  setDraft: (key: FilterKey, value: string | string[] | null) => void;
  apply: () => void;
  reset: () => void;
  resetKey: (key: FilterKey) => void;
  close: () => void;
}

export function useFilterState(defs: FilterDef[]): UseFilterStateResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Applied state (from URL)
  const applied = useMemo(() => {
    return parseFromSearchParams(searchParams, defs);
  }, [searchParams, defs]);

  // 2. Draft state (local)
  const [draft, setDraftState] = useState<AppliedState>({});
  
  // 3. UI state
  const [openKey, setOpenKey] = useState<FilterKey | null>(null);

  // Initialize draft from applied when opening
  const beginDraft = useCallback((key: FilterKey) => {
    setDraftState((prev) => ({
      ...prev,
      [key]: applied[key] ?? (defs.find(d => d.key === key)?.mode === 'multi' ? [] : null),
    }));
  }, [applied, defs]);

  // Update draft
  const setDraft = useCallback((key: FilterKey, value: string | string[] | null) => {
    setDraftState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Apply drafts to URL
  const apply = useCallback(() => {
    // Only apply the currently open key's draft? Or all drafts?
    // Requirement says "apply() -> writes ALL current draft values for defs to URL".
    // Usually user opens one filter, changes it, hits Apply inside that filter.
    // So we apply the draft for the open key, or all keys if we want batch.
    // Let's apply all keys present in draft to be safe, but usually draft only has the open key populated.
    
    // We need to merge draft into applied to build the new query
    // BUT wait, applied is read-only from URL.
    // We build the next query from current params + draft changes.
    
    const nextQuery = buildNextQuery(searchParams, defs, draft);
    router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
    
    // Close after apply
    setOpenKey(null);
    // Draft will be re-synced from URL on next render or next open
  }, [draft, searchParams, defs, router, pathname]);

  // Reset all filters
  const reset = useCallback(() => {
    // Clear all keys defined in defs from URL
    const nextQuery = new URLSearchParams(searchParams.toString());
    defs.forEach(def => {
        nextQuery.delete(def.queryParam || def.key);
    });
    router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
    
    // Clear draft
    setDraftState({});
    setOpenKey(null);
  }, [searchParams, defs, router, pathname]);

  // Reset single key
  const resetKey = useCallback((key: FilterKey) => {
    // 1. Update draft
    setDraftState(prev => ({ ...prev, [key]: null }));
    
    // 2. Update URL immediately
    // Or wait for user to click Apply? Usually Reset clears immediately and closes.
    // Requirement: "Reset clears both draft and URL for those filter keys."
    // Let's clear URL immediately.
    
    const def = defs.find(d => d.key === key);
    if (!def) return;
    
    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.delete(def.queryParam || def.key);
    router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
    
    // 3. Close
    setOpenKey(null);
  }, [searchParams, defs, router, pathname]);

  // Close without applying
  const close = useCallback(() => {
    setOpenKey(null);
    // Draft remains but is ignored until next beginDraft overwrites it
  }, []);

  return {
    applied,
    draft,
    openKey,
    setOpenKey,
    beginDraft,
    setDraft,
    apply,
    reset,
    resetKey,
    close,
  };
}
