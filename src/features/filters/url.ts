import { ReadonlyURLSearchParams } from 'next/navigation';
import { FilterDef, AppliedState } from './types';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Parses current search params into AppliedState based on definitions.
 * - single: reads string, if present
 * - multi: reads comma-separated string, splits into array
 */
export function parseFromSearchParams(
  searchParams: ReadonlyURLSearchParams,
  defs: FilterDef[]
): AppliedState {
  const state: AppliedState = {};

  defs.forEach((def) => {
    const paramName = def.queryParam || def.key;
    const rawValue = searchParams.get(paramName);

    if (def.mode === 'single') {
      state[def.key] = rawValue; // string or null
    } else {
      // multi
      if (rawValue) {
        state[def.key] = rawValue.split(',').filter(Boolean);
      } else {
        state[def.key] = [];
      }
    }
  });

  return state;
}

/**
 * Builds a new URLSearchParams object by applying a patch to the current params.
 * The patch contains the new values for specific filter keys.
 */
export function buildNextQuery(
  searchParams: ReadonlyURLSearchParams,
  defs: FilterDef[],
  patch: AppliedState
): URLSearchParams {
  const nextParams = new URLSearchParams(searchParams.toString());

  defs.forEach((def) => {
    // If the key is present in the patch, update the param
    if (def.key in patch) {
      const paramName = def.queryParam || def.key;
      const newValue = patch[def.key];

      if (newValue === null || (Array.isArray(newValue) && newValue.length === 0) || newValue === '') {
        nextParams.delete(paramName);
      } else {
        if (Array.isArray(newValue)) {
          nextParams.set(paramName, newValue.join(','));
        } else {
          nextParams.set(paramName, newValue as string);
        }
      }
    }
  });

  return nextParams;
}

/**
 * Pushes or replaces the current route with the new applied filters.
 * Ensures stable ordering of params is handled by URLSearchParams naturally (insertion order).
 * However, we might want to sort keys for pure stability, but browser usually handles it fine.
 */
export function setAppliedFiltersToUrl(
  router: AppRouterInstance,
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  defs: FilterDef[],
  nextApplied: AppliedState
) {
  const nextQuery = buildNextQuery(searchParams, defs, nextApplied);
  // Using replace to avoid polluting history with every filter change, usually preferred.
  // Or push if we want back button support. Let's use replace by default for filters 
  // unless explicitly requested otherwise, but requirements say "persistence after reload", 
  // which URL does. History navigation is UX choice. Let's use replace to keep history clean 
  // for minor tweaks, or push? Standard is usually replace for filters to avoid 50 back clicks.
  // Actually, requirement says "source of truth MUST be the URL query string".
  // Let's use replace for now.
  router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
}
