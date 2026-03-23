/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useCallback } from "react";
import {
  useSearchParams,
  useRouter,
  usePathname,
  ReadonlyURLSearchParams,
} from "next/navigation";
import { whenLabel } from "./whenLabel";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

export type WhenPreset = "TODAY" | "TOMORROW" | "WEEKEND" | null;

/** Primary discovery filters — источник правды: URL (searchParams) */
export type DiscoveryFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  whenPreset: WhenPreset;
  age: string[];
  metro: string | null;
  district: string | null;
  nearby: boolean;
};

export const defaultFilters: DiscoveryFilters = {
  dateFrom: null,
  dateTo: null,
  whenPreset: null,
  age: [],
  metro: null,
  district: null,
  nearby: false,
};

export type OpenKey = "date" | "age" | "metro" | "district" | null;

function mergeDiscoveryPatch(
  base: DiscoveryFilters,
  patch: Partial<DiscoveryFilters>,
): DiscoveryFilters {
  const next: DiscoveryFilters = { ...base, ...patch };

  if (Object.prototype.hasOwnProperty.call(patch, "whenPreset")) {
    if (patch.whenPreset !== null && patch.whenPreset !== undefined) {
      next.dateFrom = null;
      next.dateTo = null;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, "dateFrom") ||
    Object.prototype.hasOwnProperty.call(patch, "dateTo")
  ) {
    if (next.dateFrom || next.dateTo) {
      next.whenPreset = null;
    }
  }

  return next;
}

export function parseAppliedFromUrl(
  searchParams: ReadonlyURLSearchParams,
): DiscoveryFilters {
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

  const validAgeIds = new Set(AGE_GROUPS.map((g) => g.value));
  const sanitizedAge = age.filter((id) => validAgeIds.has(id));

  const legacyAgeMap: Record<string, string> = {
    "0+": "0-1",
    "6+": "5-7",
    "12+": "12-14",
  };

  const mappedAge = sanitizedAge.map((id) => legacyAgeMap[id] || id);

  const metroParam = searchParams.get("metro");
  const metro = metroParam
    ? metroParam.includes(",")
      ? metroParam.split(",")[0]
      : metroParam
    : null;

  const district = searchParams.get("district") || null;

  const nearby = searchParams.get("nearby") === "true";

  const presetParam = searchParams.get("preset");
  let whenPreset: WhenPreset = null;
  if (
    presetParam === "TODAY" ||
    presetParam === "TOMORROW" ||
    presetParam === "WEEKEND"
  ) {
    whenPreset = presetParam;
  }

  return {
    dateFrom: dFrom || null,
    dateTo: dTo || null,
    whenPreset,
    age: mappedAge,
    metro,
    district,
    nearby,
  };
}

function writeAppliedToUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  next: DiscoveryFilters,
  mode: "replace" | "push" = "replace",
) {
  const params = new URLSearchParams(searchParams.toString());

  if (next.dateFrom) params.set("from", next.dateFrom);
  else params.delete("from");
  if (next.dateTo) params.set("to", next.dateTo);
  else params.delete("to");
  params.delete("when");
  params.delete("dateFrom");
  params.delete("dateTo");

  if (next.whenPreset) params.set("preset", next.whenPreset);
  else params.delete("preset");

  if (next.age.length > 0) params.set("age", next.age.join(","));
  else params.delete("age");

  if (next.metro) params.set("metro", next.metro);
  else params.delete("metro");

  if (next.district) params.set("district", next.district);
  else params.delete("district");

  if (next.nearby) params.set("nearby", "true");
  else params.delete("nearby");

  const queryString = params.toString();
  const url = queryString ? `${pathname}?${queryString}` : pathname;

  if (mode === "push") router.push(url, { scroll: false });
  else router.replace(url, { scroll: false });
}

export function useDiscoveryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applied = useMemo(
    () => parseAppliedFromUrl(searchParams),
    [searchParams],
  );

  const patchFilters = useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      const base = parseAppliedFromUrl(searchParams);
      const next = mergeDiscoveryPatch(base, patch);
      writeAppliedToUrl(router, pathname, searchParams, next, "replace");
    },
    [router, pathname, searchParams],
  );

  const actions = useMemo(
    () => ({
      /** @deprecated Кнопки Go больше нет — оставлено для совместимости */
      apply: () => {},
      /** Немедленная запись в URL (реактивные фильтры) */
      setDraft: patchFilters,
      resetAll: () => {
        writeAppliedToUrl(
          router,
          pathname,
          searchParams,
          defaultFilters,
          "replace",
        );
      },
      resetKey: (key: keyof DiscoveryFilters) => {
        const base = parseAppliedFromUrl(searchParams);
        const next = { ...base, [key]: defaultFilters[key] };
        if (key === "dateFrom" || key === "dateTo") {
          next.dateFrom = null;
          next.dateTo = null;
        }
        writeAppliedToUrl(router, pathname, searchParams, next, "replace");
      },
      /** Закрыть панель без отката URL */
      close: () => {},
    }),
    [router, pathname, searchParams, applied, patchFilters],
  );

  const derived = useMemo(() => {
    const filters = applied;

    const isDirty =
      !!filters.dateFrom ||
      !!filters.dateTo ||
      !!filters.whenPreset ||
      filters.age.length > 0 ||
      !!filters.metro ||
      !!filters.district ||
      filters.nearby;

    const activeCount =
      (filters.dateFrom || filters.dateTo || filters.whenPreset ? 1 : 0) +
      (filters.age.length > 0 ? 1 : 0) +
      (filters.metro ? 1 : 0) +
      (filters.district ? 1 : 0) +
      (filters.nearby ? 1 : 0);

    const dateLabel = whenLabel(filters);

    const ageLabel =
      filters.age.length > 0
        ? filters.age.length === 1
          ? filters.age[0]
          : `Возраст: ${filters.age.length}`
        : "Возраст";

    const metroLabel = filters.metro || "Метро";

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

  const setDraft = patchFilters;

  return {
    applied,
    /** Алиас для совместимости; совпадает с applied */
    draft: applied,
    openKey: null as OpenKey | null,
    setOpenKey: (_: OpenKey | null) => {},
    beginDraft: (_key: unknown) => {},
    setDraft,
    patchFilters,
    actions,
    derived,
  };
}
