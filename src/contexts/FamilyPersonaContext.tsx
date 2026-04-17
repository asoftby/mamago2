"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";
import { toast } from "sonner";

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
  setSelectedPersonaIds: (next: string[]) => void;
  /** Данные primary adult для меню профиля — без отдельного fetch */
  menuUser: AccountMenuUser | null;
  /** Дети для фильтра (совместимо с прежним profileChildren) */
  childPersonasForFilter: Array<{ id: string; name: string; birthDate?: string }>;
  refresh: () => Promise<void>;
};

const FamilyPersonaContext = createContext<FamilyPersonaContextValue | null>(null);

export function FamilyPersonaProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeApiUser | null>(null);
  const [childRows, setChildRows] = useState<
    Array<{ id: string; name: string; birthDate?: string | null }>
  >([]);
  const [selectedPersonaIds, setSelectedPersonaIdsState] = useState<string[]>([]);

  const personas = useMemo(
    () => (me ? buildPersonas(me, childRows) : []),
    [me, childRows],
  );

  const allowedIds = useMemo(() => new Set(personas.map((p) => p.id)), [personas]);

  const primaryAdultPersonaId = me?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, chRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include", cache: "no-store" }),
        fetch("/api/children", { credentials: "include", cache: "no-store" }),
      ]);
      if (!meRes.ok) {
        setMe(null);
        setChildRows([]);
        setSelectedPersonaIdsState([]);
        return;
      }
      const meJson = (await meRes.json()) as MeApiUser;
      setMe(meJson);

      let children: Array<{ id: string; name: string; birthDate?: string | null }> = [];
      if (chRes.ok) {
        const data = (await chRes.json()) as {
          children?: Array<{ id: string; name: string; birthDate?: string | null }>;
        };
        children = Array.isArray(data.children) ? data.children : [];
      }
      setChildRows(children);

      const built = buildPersonas(meJson, children);
      const allIds = built.map((p) => p.id);
      const allowed = new Set(allIds);
      const stored = readStoredIds(allIds);
      const next = normalizeStoredSelection(stored, allowed, built, meJson.id);
      setSelectedPersonaIdsState(next);
      try {
        localStorage.setItem(STORAGE_SELECTED, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    } catch {
      setMe(null);
      setChildRows([]);
      setSelectedPersonaIdsState([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Новые персоны: добавляем только если есть место (до 3), иначе оставляем ручной выбор. */
  useEffect(() => {
    if (loading || allowedIds.size === 0) return;
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
    const onAuth = () => void load();
    const onFamily = () => void load();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, onAuth);
    window.addEventListener(FAMILY_PERSONAS_CHANGED_EVENT, onFamily);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, onAuth);
      window.removeEventListener(FAMILY_PERSONAS_CHANGED_EVENT, onFamily);
    };
  }, [load]);

  const setSelectedPersonaIds = useCallback(
    (next: string[]) => {
      const filtered = next.filter((id) => allowedIds.has(id));
      if (filtered.length > MAX_ACTIVE_FAMILY_PERSONAS) {
        toast(FAMILY_SELECTION_LIMIT_MESSAGE, { duration: 4200 });
        return;
      }
      // Взрослого можно снять; пустой выбор = свободный режим (все события без фильтра «для кого»).
      setSelectedPersonaIdsState(filtered);
      try {
        localStorage.setItem(STORAGE_SELECTED, JSON.stringify(filtered));
      } catch {
        /* ignore */
      }
    },
    [allowedIds],
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

  const menuUser: AccountMenuUser | null = me
    ? {
        id: me.id,
        email: me.email,
        role: me.role,
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
    : null;

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
      refresh: load,
    }),
    [
      loading,
      personas,
      primaryAdultPersonaId,
      selectedPersonaIds,
      setSelectedPersonaIds,
      menuUser,
      childPersonasForFilter,
      load,
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
