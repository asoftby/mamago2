"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { AccountMenuUser } from "@/lib/account/types";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import {
  FAMILY_PERSONAS_CHANGED_EVENT,
} from "@/lib/family/familyPersonaEvents";
import {
  computeWholeFamilyPresetIds,
  MAX_ACTIVE_FAMILY_PERSONAS,
  FAMILY_SELECTION_LIMIT_MESSAGE,
} from "@/lib/family/wholeFamilyPreset";
import { MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY } from "@/lib/family/postMyPlanRegistrationFocus";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { toast } from "@/lib/toast";

const STORAGE_SELECTED = "mamago:selectedPersonaIds";

type MeApiUser = AccountMenuUser & Record<string, unknown>;

function buildPersonas(me: MeApiUser, children: Array<{ id: string; name: string; birthDate?: string | null }>): FamilyPersona[] {
  const hasDisplayName = !!me.displayName?.trim();
  const adult: FamilyPersona = {
    id: me.id,
    kind: "adult",
    displayName: me.displayName?.trim() || me.email?.split("@")[0] || "Я",
    avatarUrl: me.avatarUrl ?? null,
    familyRole: me.familyRole ?? null,
    ageBandLabel: me.ageBandLabel ?? null,
    preferenceSummary: me.preferenceSummary ?? null,
    leisureFormatSummary: me.leisureFormatSummary ?? null,
    preferenceSignalIds: Array.isArray(me.preferenceSignalIds) ? me.preferenceSignalIds : [],
    leisureFormatSignalId:
      typeof me.leisureFormatSignalId === "string" ? me.leisureFormatSignalId : null,
    isProfileComplete: hasDisplayName,
  };
  const childPersonas: FamilyPersona[] = children.map((c) => ({
    id: c.id,
    kind: "child",
    displayName: c.name,
    birthDate: c.birthDate ?? null,
  }));
  return [adult, ...childPersonas];
}

function readStoredIds(fallback: string[]): string[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_SELECTED);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return fallback;
  }
}

function normalizeStoredSelection(
  ids: string[],
  allowed: Set<string>,
  personas: FamilyPersona[],
  primaryId: string | null,
): string[] {
  const filtered = ids.filter((id) => allowed.has(id));
  if (filtered.length > MAX_ACTIVE_FAMILY_PERSONAS) {
    return computeWholeFamilyPresetIds(personas, primaryId);
  }
  /** Пустой массив — свободный режим «Для кого» (без персонализации по возрасту) */
  if (filtered.length === 0) {
    return [];
  }
  return filtered;
}

type FamilyPersonaContextValue = {
  /** Загрузка me+children */
  loading: boolean;
  /** Все персоны: взрослый первый, затем дети */
  personas: FamilyPersona[];
  /** = текущий пользователь (единственный взрослый в MVP) */
  primaryAdultPersonaId: string | null;
  /** Выбранный контекст «Для кого» (вкл. id взрослого и детей) */
  selectedPersonaIds: string[];
  setSelectedPersonaIds: (next: string[] | ((prev: string[]) => string[])) => void;
  /** Данные primary adult для меню профиля — без отдельного fetch */
  menuUser: AccountMenuUser | null;
  /** Дети для фильтра (совместимо с прежним profileChildren) */
  childPersonasForFilter: Array<{ id: string; name: string; birthDate?: string }>;
  refresh: () => Promise<void>;
};

const FamilyPersonaContext = createContext<FamilyPersonaContextValue | null>(null);

/** Paths where family persona is not needed — skip API fetch entirely */
function shouldSkipFamilyPersona(pathname: string): boolean {
  return pathname.startsWith("/admin/");
}

async function fetchChildrenRows() {
  const chRes = await fetch("/api/children", {
    credentials: "include",
    cache: "no-store",
  });
  if (!chRes.ok) {
    return [];
  }

  const data = (await chRes.json()) as {
    children?: Array<{ id: string; name: string; birthDate?: string | null }>;
  };
  return Array.isArray(data.children) ? data.children : [];
}

export function FamilyPersonaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, status, isLoading: authLoading, refetch: refetchAuth } = useAuthMe();
  const [childRows, setChildRows] = useState<
    Array<{ id: string; name: string; birthDate?: string | null }>
  >([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [selectedPersonaIds, setSelectedPersonaIdsState] = useState<string[]>([]);
  const hasUserTouchedSelectionRef = useRef(false);
  const me = status === "authenticated" ? (user as MeApiUser) : null;
  const loading = authLoading || (status === "authenticated" && childrenLoading);

  const personas = useMemo(
    () => (me ? buildPersonas(me, childRows) : []),
    [me, childRows],
  );

  const allowedIds = useMemo(() => new Set(personas.map((p) => p.id)), [personas]);

  const primaryAdultPersonaId = me?.id ?? null;

  const applyAuthenticatedState = useCallback(async (authUser: MeApiUser) => {
    setChildrenLoading(true);
    try {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[FamilyPersona] auth resolved", {
          userId: authUser.id,
          hasDisplayName: Boolean(authUser.displayName),
          source: "AuthProvider",
        });
      }

      const children = await fetchChildrenRows();
      if (process.env.NODE_ENV !== "production") {
        console.debug("[FamilyPersona] personas refreshed", {
          userId: authUser.id,
          childCount: children.length,
          source: "FamilyPersonaProvider",
        });
      }
      setChildRows(children);

      const built = buildPersonas(authUser, children);
      const allIds = built.map((p) => p.id);
      const allowed = new Set(allIds);
      const stored = readStoredIds(allIds);
      const next = normalizeStoredSelection(stored, allowed, built, authUser.id);
      setSelectedPersonaIdsState((prev) => {
        if (hasUserTouchedSelectionRef.current) {
          return prev.filter((id) => allowed.has(id));
        }
        return next;
      });
      if (!hasUserTouchedSelectionRef.current) {
        try {
          localStorage.setItem(STORAGE_SELECTED, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    } catch {
      setChildRows([]);
      if (!hasUserTouchedSelectionRef.current) {
        setSelectedPersonaIdsState([]);
      }
    } finally {
      setChildrenLoading(false);
    }
  }, []);

  const loadChildren = useCallback(async () => {
    if (status !== "authenticated" || !user) {
      setChildRows([]);
      setSelectedPersonaIdsState([]);
      return;
    }

    await applyAuthenticatedState(user as MeApiUser);
  }, [status, user, applyAuthenticatedState]);

  useEffect(() => {
    // Skip children fetch on /me/* and /admin/* — data not needed for discovery filters
    if (shouldSkipFamilyPersona(pathname)) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[FamilyPersona] skipped — path excluded", { pathname });
      }
      return;
    }
    if (status !== "authenticated") {
      setChildRows([]);
      setSelectedPersonaIdsState([]);
      return;
    }
    void loadChildren();
  }, [status, user?.id, loadChildren, pathname]);

  /** Новые персоны: добавляем только если есть место (до 3), иначе оставляем ручной выбор. */
  useEffect(() => {
    if (loading || allowedIds.size === 0) return;
    if (hasUserTouchedSelectionRef.current) return;
    setSelectedPersonaIdsState((prev) => {
      const prevFiltered = prev.filter((id) => allowedIds.has(id));
      /** Явный свободный режим (ничего не выбрано) — не подмешиваем новых персон */
      if (prevFiltered.length === 0 && prev.length === 0) {
        return prev;
      }
      const missing = [...allowedIds].filter((id) => !prevFiltered.includes(id));
      if (missing.length === 0) {
        return prevFiltered.length === prev.length ? prev : prevFiltered;
      }
      const merged = [...prevFiltered];
      for (const m of missing) {
        if (merged.length >= MAX_ACTIVE_FAMILY_PERSONAS) break;
        merged.push(m);
      }
      if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
      try {
        localStorage.setItem(STORAGE_SELECTED, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  }, [loading, allowedIds]);

  useEffect(() => {
    const onFamily = () => void loadChildren();
    window.addEventListener(FAMILY_PERSONAS_CHANGED_EVENT, onFamily);
    return () => {
      window.removeEventListener(FAMILY_PERSONAS_CHANGED_EVENT, onFamily);
    };
  }, [loadChildren]);

  const setSelectedPersonaIds = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      hasUserTouchedSelectionRef.current = true;
      const resolvedNext =
        typeof next === "function" ? next(selectedPersonaIds) : next;
      const sanitized = resolvedNext.filter((id) => allowedIds.has(id));
      if (sanitized.length > MAX_ACTIVE_FAMILY_PERSONAS) {
        toast(FAMILY_SELECTION_LIMIT_MESSAGE, { duration: 4200 });
        return;
      }
      // Взрослого можно снять; пустой выбор = свободный режим (все события без фильтра «для кого»).
      setSelectedPersonaIdsState(sanitized);
      try {
        localStorage.setItem(STORAGE_SELECTED, JSON.stringify(sanitized));
      } catch {
        /* ignore */
      }
    },
    [allowedIds, selectedPersonaIds],
  );

  /** После регистрации из «Мой план» — выбрать взрослого + только что созданного ребёнка для подборки. */
  useEffect(() => {
    if (loading || !me) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY);
    } catch {
      return;
    }
    if (!raw?.trim()) return;
    const childId = raw.trim();
    if (childRows.length === 0 || !childRows.some((c) => c.id === childId)) return;

    try {
      sessionStorage.removeItem(MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY);
    } catch {
      /* ignore */
    }

    const built = buildPersonas(me, childRows);
    const allowed = new Set(built.map((p) => p.id));
    const adultId = me.id;
    const next = [adultId, childId].filter((id) => allowed.has(id));
    if (next.length === 0) return;

    setSelectedPersonaIds(next);
  }, [loading, me, childRows, setSelectedPersonaIds]);

  const menuUser = useMemo<AccountMenuUser | null>(
    () =>
      me
        ? {
            id: me.id,
            email: me.email,
            role: me.role,
            hasApprovedBusinessProfile: me.hasApprovedBusinessProfile,
            businessBalanceBYN: me.businessBalanceBYN,
            displayName: me.displayName ?? null,
            avatarUrl: me.avatarUrl ?? null,
            familyRole: me.familyRole ?? null,
            ageBandLabel: me.ageBandLabel ?? null,
            preferenceSummary: me.preferenceSummary ?? null,
            leisureFormatSummary: me.leisureFormatSummary ?? null,
            preferenceSignalIds: Array.isArray(me.preferenceSignalIds) ? me.preferenceSignalIds : [],
            leisureFormatSignalId:
              typeof me.leisureFormatSignalId === "string" ? me.leisureFormatSignalId : null,
          }
        : null,
    [me],
  );

  const childPersonasForFilter = useMemo(
    () =>
      childRows.map((c) => ({
        id: c.id,
        name: c.name,
        ...(c.birthDate ? { birthDate: c.birthDate } : {}),
      })),
    [childRows],
  );

  const value = useMemo(
    (): FamilyPersonaContextValue => ({
      loading,
      personas,
      primaryAdultPersonaId,
      selectedPersonaIds,
      setSelectedPersonaIds,
      menuUser,
      childPersonasForFilter,
      refresh: async () => {
        const nextUser = await refetchAuth();
        if (!nextUser) {
          setChildRows([]);
          setSelectedPersonaIdsState([]);
          return;
        }
        await applyAuthenticatedState(nextUser as MeApiUser);
      },
    }),
    [
      loading,
      personas,
      primaryAdultPersonaId,
      selectedPersonaIds,
      setSelectedPersonaIds,
      menuUser,
      childPersonasForFilter,
      refetchAuth,
      applyAuthenticatedState,
    ],
  );

  return (
    <FamilyPersonaContext.Provider value={value}>{children}</FamilyPersonaContext.Provider>
  );
}

export function useFamilyPersona(): FamilyPersonaContextValue | null {
  return useContext(FamilyPersonaContext);
}

export function useFamilyPersonaRequired(): FamilyPersonaContextValue {
  const ctx = useContext(FamilyPersonaContext);
  if (!ctx) {
    throw new Error("useFamilyPersonaRequired must be used inside FamilyPersonaProvider");
  }
  return ctx;
}
