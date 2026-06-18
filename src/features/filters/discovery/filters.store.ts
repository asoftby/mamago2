 
import { useMemo, useCallback, useEffect, useSyncExternalStore } from "react";
import {
  useSearchParams,
  useRouter,
  usePathname,
  ReadonlyURLSearchParams,
} from "next/navigation";
import { whenLabel } from "./whenLabel";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useOptionalCity } from "@/contexts/CityContext";
import {
  getCityFromPath,
  getIntentFromPath,
  getDiscoveryIntentForPublicationPath,
  isDiscoveryListingPath,
  shouldHideMobileBottomNav,
  type Intent,
} from "@/lib/intent";
import { parseActivityFormatQuery, serializeActivityFormatQuery } from "@/domain/activities/activity-format";

export type WhenPreset = "TODAY" | "TOMORROW" | "WEEKEND" | null;

/** Primary discovery filters — источник правды: URL (searchParams) */
export type DiscoveryFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  whenPreset: WhenPreset;
  age: string[];
  format: "OFFLINE" | "ONLINE" | "HYBRID" | null;
  metro: string | null;
  district: string | null;
  nearby: boolean;
};

export const defaultFilters: DiscoveryFilters = {
  dateFrom: null,
  dateTo: null,
  whenPreset: null,
  age: [],
  format: null,
  metro: null,
  district: null,
  nearby: false,
};

export function isDiscoveryFiltersEmpty(f: DiscoveryFilters): boolean {
  return (
    !f.dateFrom &&
    !f.dateTo &&
    !f.whenPreset &&
    f.age.length === 0 &&
    !f.format &&
    !f.metro &&
    !f.district &&
    !f.nearby
  );
}

const SESSION_PREFIX = "mmg.discovery.filtersByScope.v1";

function discoverySessionKey(city: string, intent: Intent): string {
  return `${SESSION_PREFIX}:${city}:${intent}`;
}

function saveDiscoveryFiltersSession(
  city: string,
  intent: Intent,
  filters: DiscoveryFilters,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(discoverySessionKey(city, intent), JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

function loadDiscoveryFiltersSession(
  city: string,
  intent: Intent,
): DiscoveryFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(discoverySessionKey(city, intent));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DiscoveryFilters>;
    return {
      ...defaultFilters,
      ...parsed,
      age: Array.isArray(parsed.age) ? parsed.age : [],
    };
  } catch {
    return null;
  }
}

function clearDiscoveryFiltersSession(city: string, intent: Intent): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(discoverySessionKey(city, intent));
  } catch {
    /* ignore */
  }
}

/** Чтобы эффект «восстановить из session» не подставлял старый age после «Для всех» / сброса возраста. */
function stripAgeFromStoredDiscoverySession(
  cityForSession: string,
  pathname: string,
  next: DiscoveryFilters,
): void {
  if (next.age.length > 0) return;
  const intent =
    getIntentFromPath(pathname) ?? getDiscoveryIntentForPublicationPath(pathname);
  if (!intent) return;
  const stored = loadDiscoveryFiltersSession(cityForSession, intent);
  if (!stored || stored.age.length === 0) return;
  saveDiscoveryFiltersSession(cityForSession, intent, { ...stored, age: [] });
}

function hasDiscoveryFilterParamsInUrl(
  searchParams: ReadonlyURLSearchParams,
): boolean {
  return !!(
    searchParams.get("from") ||
    searchParams.get("to") ||
    searchParams.get("when") ||
    searchParams.get("preset") ||
    searchParams.get("age") ||
    searchParams.get("format") ||
    searchParams.get("metro") ||
    searchParams.get("district") ||
    searchParams.get("nearby") === "true"
  );
}

function hasAnyUrlParams(searchParams: ReadonlyURLSearchParams): boolean {
  return Array.from(searchParams.keys()).length > 0;
}

export type OpenKey = "date" | "age" | "metro" | "district" | null;

export function mergeDiscoveryPatch(
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

  if (next.format === "ONLINE") {
    next.nearby = false;
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

  const ageRaw = searchParams.get("age")?.split(",").filter(Boolean) || [];

  const legacyAgeMap: Record<string, string> = {
    "0+": "0-1",
    "6+": "5-7",
    "12+": "12-14",
    "18_plus": "18+",
  };

  const ageNormalized = ageRaw.map((id) => legacyAgeMap[id] ?? id);

  const validAgeIds = new Set(AGE_GROUPS.map((g) => g.value));
  const mappedAge = ageNormalized.filter((id) => validAgeIds.has(id));

  const metroParam = searchParams.get("metro");
  const metro = metroParam
    ? metroParam.includes(",")
      ? metroParam.split(",")[0]
      : metroParam
    : null;

  const district = searchParams.get("district") || null;
  const format = parseActivityFormatQuery(searchParams.get("format"));

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
    format,
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

  const formatQuery = serializeActivityFormatQuery(next.format);
  if (formatQuery) params.set("format", formatQuery);
  else params.delete("format");

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
  const optionalCity = useOptionalCity();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const cityForSession = useMemo(() => {
    return getCityFromPath(pathname) ?? optionalCity?.citySlug ?? "minsk";
  }, [pathname, optionalCity?.citySlug]);

  const appliedFromUrl = useMemo(
    () => parseAppliedFromUrl(searchParams),
    [searchParams],
  );

  const publicationIntent = useMemo(
    () => getDiscoveryIntentForPublicationPath(pathname),
    [pathname],
  );

  /** На страницах публикаций без query — подставляем последние фильтры этого раздела из sessionStorage */
  const applied = useMemo(() => {
    if (!isDiscoveryFiltersEmpty(appliedFromUrl)) {
      return appliedFromUrl;
    }
    if (!hasMounted || typeof window === "undefined") {
      return appliedFromUrl;
    }
    if (
      publicationIntent &&
      cityForSession &&
      shouldHideMobileBottomNav(pathname)
    ) {
      const stored = loadDiscoveryFiltersSession(
        cityForSession,
        publicationIntent,
      );
      if (stored && !isDiscoveryFiltersEmpty(stored)) {
        return stored;
      }
    }
    return appliedFromUrl;
  }, [appliedFromUrl, hasMounted, publicationIntent, cityForSession, pathname]);

  /** Сохраняем фильтры раздела при просмотре списка discovery */
  useEffect(() => {
    const intent = getIntentFromPath(pathname);
    if (!intent || !cityForSession) return;
    if (!isDiscoveryListingPath(pathname)) return;
    if (isDiscoveryFiltersEmpty(appliedFromUrl)) return;
    saveDiscoveryFiltersSession(cityForSession, intent, appliedFromUrl);
  }, [pathname, cityForSession, appliedFromUrl]);

  /** Возврат в список без query — восстанавливаем из sessionStorage */
  useEffect(() => {
    const intent = getIntentFromPath(pathname);
    if (!intent || !cityForSession) return;
    if (!isDiscoveryListingPath(pathname)) return;
    // Any query params in the URL take precedence over local storage.
    // This keeps shared links stable even when they carry non-filter params.
    if (hasAnyUrlParams(searchParams)) {
      return;
    }
    if (hasDiscoveryFilterParamsInUrl(searchParams)) return;
    const stored = loadDiscoveryFiltersSession(cityForSession, intent);
    if (!stored || isDiscoveryFiltersEmpty(stored)) return;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DiscoveryFilters] restoring stored filters into listing URL", {
        pathname,
        cityForSession,
        intent,
      });
    }
    writeAppliedToUrl(router, pathname, searchParams, stored, "replace");
  }, [pathname, cityForSession, searchParams, router]);

  const clearSessionForCurrentRoute = useCallback(() => {
    const intent =
      getIntentFromPath(pathname) ?? getDiscoveryIntentForPublicationPath(pathname);
    if (!intent || !cityForSession) return;
    clearDiscoveryFiltersSession(cityForSession, intent);
  }, [pathname, cityForSession]);

  const patchFilters = useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      const next = mergeDiscoveryPatch(applied, patch);
      writeAppliedToUrl(router, pathname, searchParams, next, "replace");
      stripAgeFromStoredDiscoverySession(cityForSession, pathname, next);
    },
    [router, pathname, searchParams, applied, cityForSession],
  );

  const actions = useMemo(
    () => ({
      /** @deprecated Кнопки Go больше нет — оставлено для совместимости */
      apply: () => {},
      /** Немедленная запись в URL (реактивные фильтры) */
      setDraft: patchFilters,
      resetAll: () => {
        clearSessionForCurrentRoute();
        writeAppliedToUrl(
          router,
          pathname,
          searchParams,
          defaultFilters,
          "replace",
        );
      },
      resetKey: (key: keyof DiscoveryFilters) => {
        const base = applied;
        const next = { ...base, [key]: defaultFilters[key] };
        if (key === "dateFrom" || key === "dateTo") {
          next.dateFrom = null;
          next.dateTo = null;
        }
        writeAppliedToUrl(router, pathname, searchParams, next, "replace");
        stripAgeFromStoredDiscoverySession(cityForSession, pathname, next);
      },
      /** Одна замена URL: полное состояние фильтров + при необходимости другой pathname (моб. шит «Готово»). */
      commitFilters: (
        next: DiscoveryFilters,
        pathnameOverride?: string,
      ) => {
        const path = pathnameOverride ?? pathname;
        const empty = new URLSearchParams();
        writeAppliedToUrl(
          router,
          path,
          empty as unknown as ReadonlyURLSearchParams,
          next,
          "replace",
        );
        stripAgeFromStoredDiscoverySession(cityForSession, path, next);
      },
      /** Закрыть панель без отката URL */
      close: () => {},
    }),
    [
      router,
      pathname,
      searchParams,
      applied,
      patchFilters,
      clearSessionForCurrentRoute,
      cityForSession,
    ],
  );

  const derived = useMemo(() => {
    const filters = applied;

    const isDirty =
      !!filters.dateFrom ||
      !!filters.dateTo ||
      !!filters.whenPreset ||
      filters.age.length > 0 ||
      !!filters.format ||
      !!filters.metro ||
      !!filters.district ||
      filters.nearby;

    const activeCount =
      (filters.dateFrom || filters.dateTo || filters.whenPreset ? 1 : 0) +
      (filters.age.length > 0 ? 1 : 0) +
      (filters.format ? 1 : 0) +
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

    const formatLabel =
      filters.format === "OFFLINE"
        ? "Офлайн"
        : filters.format === "ONLINE"
          ? "Онлайн"
          : filters.format === "HYBRID"
            ? "Гибрид"
            : "Формат";

    const metroLabel = filters.metro || "Метро";

    const districtLabel = filters.district || "Район";

    return {
      isDirty,
      activeCount,
      labels: {
        dateLabel,
        ageLabel,
        formatLabel,
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
