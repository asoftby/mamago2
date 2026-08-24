 
import { useMemo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  free: boolean;
  adultOnly: boolean;
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
  free: false,
  adultOnly: false,
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
    !f.nearby &&
    !f.free
    && !f.adultOnly
  );
}

export function discoveryFiltersEqual(a: DiscoveryFilters, b: DiscoveryFilters): boolean {
  if (
    a.dateFrom !== b.dateFrom ||
    a.dateTo !== b.dateTo ||
    a.whenPreset !== b.whenPreset ||
    a.format !== b.format ||
    a.metro !== b.metro ||
    a.district !== b.district ||
    a.nearby !== b.nearby ||
    a.free !== b.free ||
    a.adultOnly !== b.adultOnly ||
    a.age.length !== b.age.length
  ) {
    return false;
  }
  return [...a.age].sort().join("\0") === [...b.age].sort().join("\0");
}

/**
 * Оптимистичное предсказание считается «догнанным» URL-состоянием, если
 * оно эквивалентно после прогона через ту же serialize→parse функцию,
 * которой пишем реальный URL — а не через сырое структурное сравнение.
 * Иначе порядок CSV (контракт параметров нормализует порядок age по
 * справочнику) может развести предсказание и appliedFromUrl навсегда:
 * кликнули «5–7» потом «3–5» → оверлей держит ['5-7','3-5'], а в URL
 * канонически уедет ['3-5','5-7'] — без канонизации оба сравнения не
 * совпали бы никогда, и applied завис бы на устаревшем предсказании
 * до перезагрузки страницы. discoveryFiltersEqual само по себе уже
 * не зависит от порядка (сортирует age), но канонизация через реальный
 * serializer защищает и от будущих изменений нормализации (legacy id,
 * дедуп и т.п.), не только от порядка.
 */
export function optimisticFiltersSettled(
  optimistic: DiscoveryFilters,
  appliedFromUrl: DiscoveryFilters,
): boolean {
  const canonicalOptimistic = parseAppliedFromUrl(
    serializeAppliedToSearchParams(
      new URLSearchParams(),
      optimistic,
    ) as unknown as ReadonlyURLSearchParams,
  );
  return discoveryFiltersEqual(canonicalOptimistic, appliedFromUrl);
}

/** Дебаунс живой записи в URL (чипсы/десктопный попап) — см. optimisticFilters. */
export const WRITE_DEBOUNCE_MS = 150;

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

export function shouldClearStoredDiscoveryState(filters: DiscoveryFilters): boolean {
  return isDiscoveryFiltersEmpty(filters);
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
    searchParams.get("nearby") === "true" ||
    searchParams.get("free") === "true"
    || searchParams.get("adultOnly") === "true"
  );
}

/**
 * Основной канал трафика приходит с utm-метками (Instagram) — они не влияют
 * на выдачу, поэтому не должны блокировать восстановление фильтров из
 * localStorage при возврате на страницу листинга без явных discovery-параметров.
 */
const TRACKING_PARAM_PREFIXES = ["utm_"];
/** igshid/igsh — Instagram (основной канал трафика, Татьяна); остальные — стандартные click-id. */
const TRACKING_PARAM_KEYS = new Set([
  "gclid",
  "fbclid",
  "yclid",
  "ymclid",
  "msclkid",
  "igshid",
  "igsh",
  "_openstat",
]);

function isTrackingParamKey(key: string): boolean {
  return (
    TRACKING_PARAM_KEYS.has(key) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export function hasAnyNonTrackingUrlParams(searchParams: ReadonlyURLSearchParams): boolean {
  return Array.from(searchParams.keys()).some((key) => !isTrackingParamKey(key));
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
  const free = searchParams.get("free") === "true";
  const adultOnly = searchParams.get("adultOnly") === "true";

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
    free,
    adultOnly,
  };
}

function writeAppliedToUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  next: DiscoveryFilters,
  mode: "replace" | "push" = "replace",
) {
  const params = serializeAppliedToSearchParams(searchParams, next);

  const queryString = params.toString();
  const url = queryString ? `${pathname}?${queryString}` : pathname;

  if (mode === "push") router.push(url, { scroll: false });
  else router.replace(url, { scroll: false });
}

export function serializeAppliedToSearchParams(
  searchParams: Pick<URLSearchParams, "toString">,
  next: DiscoveryFilters,
): URLSearchParams {
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

  if (next.free) params.set("free", "true");
  else params.delete("free");
  if (next.adultOnly) params.set("adultOnly", "true");
  else params.delete("adultOnly");

  return params;
}

export function getDiscoveryFilterActiveCount(filters: DiscoveryFilters): number {
  return (
    (filters.dateFrom || filters.dateTo || filters.whenPreset ? 1 : 0) +
    (filters.age.length > 0 ? 1 : 0) +
    (filters.format ? 1 : 0) +
    (filters.metro ? 1 : 0) +
    (filters.district ? 1 : 0) +
    (filters.nearby ? 1 : 0) +
    (filters.free ? 1 : 0)
    + (filters.adultOnly ? 1 : 0)
  );
}

/**
 * Групп, которыми владеет модалка «Фильтры»: {ages (вкл. 18+), format,
 * area+metro, price}. Даты/city намеренно не считаются — они видны на
 * экране отдельно, и клики по ряду быстрых чипсов (Сегодня/Завтра/Выходные)
 * не должны зажигать badge на иконке модалки.
 */
export function getModalFilterCount(filters: DiscoveryFilters): number {
  return (
    (filters.age.length > 0 || filters.adultOnly ? 1 : 0) +
    (filters.format ? 1 : 0) +
    (filters.metro || filters.district ? 1 : 0) +
    (filters.free ? 1 : 0)
  );
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
  const resolvedApplied = useMemo(() => {
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

  /**
   * Живые фильтры (чипсы, десктопный попап) пишут в URL напрямую — без
   * дебаунса три быстрых клика подряд дают три router.replace и три
   * перезапроса выдачи. optimisticFilters — то, что уже видно в UI сразу
   * по клику; сама запись в URL уезжает с задержкой (см. patchFilters).
   * Снимается через optimisticFiltersSettled() прямо при рендере (без
   * setState в эффекте — react-hooks/set-state-in-effect), плюс аварийно
   * по таймеру ниже, если что-то всё же разошлось.
   */
  const [optimisticFilters, setOptimisticFilters] = useState<DiscoveryFilters | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayFailsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<{
    next: DiscoveryFilters;
    pathname: string;
    searchParams: ReadonlyURLSearchParams;
    cityForSession: string;
  } | null>(null);

  const clearOverlayFailsafe = useCallback(() => {
    if (overlayFailsafeTimerRef.current) {
      clearTimeout(overlayFailsafeTimerRef.current);
      overlayFailsafeTimerRef.current = null;
    }
  }, []);

  /**
   * Страховка на случай, если оверлей всё же не снялся сам (например,
   * appliedFromUrl не догнал предсказание по неучтённой причине) — сбросить
   * безусловно через 2× дебаунса после реальной записи. Оверлей должен
   * самоизлечиваться, а не требовать F5.
   */
  const scheduleOverlayFailsafe = useCallback(() => {
    clearOverlayFailsafe();
    overlayFailsafeTimerRef.current = setTimeout(() => {
      overlayFailsafeTimerRef.current = null;
      setOptimisticFilters(null);
    }, WRITE_DEBOUNCE_MS * 2);
  }, [clearOverlayFailsafe]);

  useEffect(() => {
    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
      if (overlayFailsafeTimerRef.current) {
        clearTimeout(overlayFailsafeTimerRef.current);
        overlayFailsafeTimerRef.current = null;
      }
      const pending = pendingWriteRef.current;
      if (!pending) return;
      pendingWriteRef.current = null;
      /**
       * Компонент размонтировался раньше, чем сработал дебаунс — типично:
       * кликнули чип, тут же тапнули карточку события. router.replace()
       * здесь опасен: гонка с уже стартовавшим переходом на карточку может
       * откатить навигацию обратно на листинг. Спасает именно сейв в
       * localStorage — вернувшись на чистый листинг, гидратация его
       * подхватит. history.replaceState — best-effort бонус (нормально
       * закрыть таб / уйти вне SPA-навигации), но к моменту, когда этот
       * cleanup реально выполняется, React (и Next) уже мог закоммитить
       * переход на URL карточки; переписывать в этот момент чужой URL
       * нельзя — получим адрес карточки с фильтрами листинга в query.
       */
      const intent = getIntentFromPath(pending.pathname);
      if (
        intent &&
        pending.cityForSession &&
        isDiscoveryListingPath(pending.pathname) &&
        !isDiscoveryFiltersEmpty(pending.next)
      ) {
        saveDiscoveryFiltersSession(pending.cityForSession, intent, pending.next);
      }
      if (typeof window !== "undefined" && window.location.pathname === pending.pathname) {
        const params = serializeAppliedToSearchParams(pending.searchParams, pending.next);
        const qs = params.toString();
        const url = qs ? `${pending.pathname}?${qs}` : pending.pathname;
        window.history.replaceState(window.history.state, "", url);
      }
    };
  }, []);

  const applied = useMemo(() => {
    if (optimisticFilters && !optimisticFiltersSettled(optimisticFilters, appliedFromUrl)) {
      return optimisticFilters;
    }
    return resolvedApplied;
  }, [optimisticFilters, appliedFromUrl, resolvedApplied]);

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
    // Any non-tracking query params in the URL take precedence over local
    // storage — keeps shared links stable even when they carry non-filter
    // params. utm/gclid/fbclid/yclid are exempt: the main traffic channel
    // (Instagram) always arrives with utm_*, and it never affects results.
    if (hasAnyNonTrackingUrlParams(searchParams)) {
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
      clearOverlayFailsafe();
      setOptimisticFilters(next);
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      pendingWriteRef.current = { next, pathname, searchParams, cityForSession };
      writeTimerRef.current = setTimeout(() => {
        writeTimerRef.current = null;
        pendingWriteRef.current = null;
        writeAppliedToUrl(router, pathname, searchParams, next, "replace");
        if (shouldClearStoredDiscoveryState(next)) clearSessionForCurrentRoute();
        stripAgeFromStoredDiscoverySession(cityForSession, pathname, next);
        scheduleOverlayFailsafe();
      }, WRITE_DEBOUNCE_MS);
    },
    [router, pathname, searchParams, applied, cityForSession, clearOverlayFailsafe, scheduleOverlayFailsafe, clearSessionForCurrentRoute],
  );

  const actions = useMemo(
    () => ({
      /** @deprecated Кнопки Go больше нет — оставлено для совместимости */
      apply: () => {},
      /** Немедленная запись в URL (реактивные фильтры), с дебаунсом 150мс */
      setDraft: patchFilters,
      resetAll: () => {
        if (writeTimerRef.current) {
          clearTimeout(writeTimerRef.current);
          writeTimerRef.current = null;
        }
        pendingWriteRef.current = null;
        clearOverlayFailsafe();
        setOptimisticFilters(defaultFilters);
        clearSessionForCurrentRoute();
        writeAppliedToUrl(
          router,
          pathname,
          new URLSearchParams() as unknown as ReadonlyURLSearchParams,
          defaultFilters,
          "replace",
        );
        scheduleOverlayFailsafe();
      },
      resetKey: (key: keyof DiscoveryFilters) => {
        if (writeTimerRef.current) {
          clearTimeout(writeTimerRef.current);
          writeTimerRef.current = null;
        }
        pendingWriteRef.current = null;
        clearOverlayFailsafe();
        const base = applied;
        const next = { ...base, [key]: defaultFilters[key] };
        if (key === "dateFrom" || key === "dateTo") {
          next.dateFrom = null;
          next.dateTo = null;
        }
        setOptimisticFilters(next);
        writeAppliedToUrl(router, pathname, searchParams, next, "replace");
        if (shouldClearStoredDiscoveryState(next)) clearSessionForCurrentRoute();
        stripAgeFromStoredDiscoverySession(cityForSession, pathname, next);
        scheduleOverlayFailsafe();
      },
      /** Одна замена URL: полное состояние фильтров + при необходимости другой pathname (моб. шит «Готово»). */
      commitFilters: (
        next: DiscoveryFilters,
        pathnameOverride?: string,
      ) => {
        if (writeTimerRef.current) {
          clearTimeout(writeTimerRef.current);
          writeTimerRef.current = null;
        }
        pendingWriteRef.current = null;
        clearOverlayFailsafe();
        const path = pathnameOverride ?? pathname;
        setOptimisticFilters(next);
        const empty = new URLSearchParams();
        writeAppliedToUrl(
          router,
          path,
          empty as unknown as ReadonlyURLSearchParams,
          next,
          "replace",
        );
        if (shouldClearStoredDiscoveryState(next)) clearSessionForCurrentRoute();
        stripAgeFromStoredDiscoverySession(cityForSession, path, next);
        scheduleOverlayFailsafe();
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
      clearOverlayFailsafe,
      scheduleOverlayFailsafe,
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
      filters.nearby ||
      filters.free ||
      filters.adultOnly;

    const activeCount = getDiscoveryFilterActiveCount(filters);

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
