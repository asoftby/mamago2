"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import type { EventFormData } from "../types";
import { EVENT_FORMAT_OPTIONS, type EventFormatPreset } from "@/lib/business/eventFormatSignals";
import { isCinemaEventCategorySlug } from "@/lib/business/eventCategoryCinema";
import * as LucideIcons from "lucide-react";
import type { ComponentType } from "react";
import { FilterSelect } from "@/components/ui/filter-select";
import { straightQuotesToGuillemets } from "@/lib/text/straightQuotesToGuillemets";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { AGE_OPTIONS, sortAgeKeys } from "@/lib/config/ages";
import type {
  DiscoveryEventCategory,
  EventStep1Taxonomies,
  PublicAgeOption,
  PublicGenreOption,
  PublicInterestOption,
} from "./step1Taxonomies";
import {
  ACTIVITY_FORMAT_OPTIONS,
  getActivityFormatOption,
} from "@/domain/activities/activity-format";

/** Совпадает с prisma/seed.ts (сигнал age) — если API недоступен или пустой. */
const FALLBACK_AGE_OPTIONS: PublicAgeOption[] = AGE_OPTIONS.map((option) => ({
  id: option.id ?? `fb-age-${option.key}`,
  label: option.label,
  value: option.key,
  order: option.order,
  active: option.active,
}));

function buildFallbackInterestOptions(): PublicInterestOption[] {
  return SYSTEM_INTERESTS.map((it, i) => ({
    id: `fb-int-${it.slug}`,
    label: it.label,
    value: it.slug,
    order: i,
    active: true,
  }));
}

interface Step1BasicsProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  initialTaxonomies?: EventStep1Taxonomies;
}

export function Step1Basics({
  data,
  onChange,
  isEditable,
  initialTaxonomies,
}: Step1BasicsProps) {
  const [rootCategories, setRootCategories] = useState<DiscoveryEventCategory[]>(
    initialTaxonomies?.categories ?? [],
  );
  const [ageOptions, setAgeOptions] = useState<PublicAgeOption[]>(
    initialTaxonomies?.ageOptions ?? [],
  );
  const [interestOptions, setInterestOptions] = useState<PublicInterestOption[]>(
    initialTaxonomies?.interestOptions ?? [],
  );
  /** Жанры по id корневой категории (после выбора категории). */
  const [genresByCategoryId, setGenresByCategoryId] = useState<
    Record<string, PublicGenreOption[]>
  >(initialTaxonomies?.genresByCategoryId ?? {});
  const [loading, setLoading] = useState(!initialTaxonomies);

  useEffect(() => {
    if (initialTaxonomies) {
      setLoading(false);
      return;
    }
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [catSettled, ageSettled, interestsSettled] = await Promise.allSettled([
          fetch("/api/public/event-categories").then(async (r) => {
            if (!r.ok) throw new Error("event-categories");
            return r.json() as Promise<{ categories?: DiscoveryEventCategory[] }>;
          }),
          fetch("/api/public/signals/age").then(async (r) => {
            if (!r.ok) throw new Error("age");
            return r.json() as Promise<{ options?: PublicAgeOption[] }>;
          }),
          fetch("/api/public/signals/interests").then(async (r) => {
            if (!r.ok) throw new Error("interests");
            return r.json() as Promise<{ options?: PublicInterestOption[] }>;
          }),
        ]);

        if (!alive) return;

        let cats: DiscoveryEventCategory[] = [];
        if (catSettled.status === "fulfilled") {
          const cr = catSettled.value;
          cats = Array.isArray(cr?.categories) ? cr.categories : [];
        }

        let ages: PublicAgeOption[] = [];
        if (ageSettled.status === "fulfilled") {
          const raw = ageSettled.value?.options;
          ages = Array.isArray(raw)
            ? raw.filter((o) => o.active).sort((a, b) => a.order - b.order || a.value.localeCompare(b.value))
            : [];
        }
        if (ages.length === 0) ages = FALLBACK_AGE_OPTIONS;

        let interests: PublicInterestOption[] = [];
        if (interestsSettled.status === "fulfilled") {
          const raw = interestsSettled.value?.options;
          interests = Array.isArray(raw)
            ? raw.filter((o) => o.active).sort((a, b) => a.order - b.order || a.value.localeCompare(b.value))
            : [];
        }
        if (interests.length === 0) interests = buildFallbackInterestOptions();

        setRootCategories(cats);
        setAgeOptions(ages);
        setInterestOptions(interests);
      } catch {
        if (!alive) return;
        setRootCategories([]);
        setAgeOptions(FALLBACK_AGE_OPTIONS);
        setInterestOptions(buildFallbackInterestOptions());
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [initialTaxonomies]);

  const primaryLeafId = data.subcategoryId ?? data.categoryId;

  const primaryRoot = useMemo(
    () => rootCategories.find((c) => c.id === data.categoryId) ?? null,
    [rootCategories, data.categoryId],
  );

  useEffect(() => {
    if (!data.categoryId) {
      if (data.primaryRootHasChildren) {
        onChange({ primaryRootHasChildren: false });
      }
      return;
    }
    const r = rootCategories.find((c) => c.id === data.categoryId);
    const has = (r?.children?.length ?? 0) > 0;
    if (has !== data.primaryRootHasChildren) {
      onChange({ primaryRootHasChildren: has });
    }
  }, [data.categoryId, data.primaryRootHasChildren, rootCategories, onChange]);

  useEffect(() => {
    let cancelled = false;
    const cid = data.categoryId;
    if (!cid) {
      setGenresByCategoryId((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }
    if (genresByCategoryId[cid]) return;

    void (async () => {
      const next: Record<string, PublicGenreOption[]> = {};
      try {
        const r = await fetch(`/api/public/genres?categoryId=${encodeURIComponent(cid)}`);
        if (!r.ok) return;
        const j = (await r.json()) as { genres?: PublicGenreOption[] };
        const list = Array.isArray(j.genres)
          ? j.genres.filter((g) => g.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
          : [];
        next[cid] = list;
      } catch {
        next[cid] = [];
      }
      if (!cancelled) setGenresByCategoryId(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [data.categoryId, genresByCategoryId]);

  const supportsProgram = Boolean(primaryRoot?.supportsProgram);
  const ageDetection = data.ageDetection ?? {
    raw: null,
    confidence: "none" as const,
    suggestedBuckets: [],
    normalizedLabel: null,
    parsedMinAge: null,
    parsedMaxAge: null,
  };

  const programSelectableItems: ChipItem[] = useMemo(() => {
    const flat: DiscoveryEventCategory[] = [];
    for (const r of rootCategories) {
      flat.push(r);
      for (const ch of r.children ?? []) flat.push(ch);
    }
    const candidates = flat
      .filter((c) => c.selectableInProgram)
      .filter((c) => (primaryLeafId ? c.id !== primaryLeafId : true))
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.nameRu.localeCompare(b.nameRu));

    const selected = new Set<string>(data.programCategoryIds ?? []);

    return candidates.map((c) => ({
      id: c.id,
      label: c.nameRu,
      active: selected.has(c.id),
      disabled: !isEditable || loading,
      onClick: () => {
        if (!isEditable || loading) return;
        const cur = Array.isArray(data.programCategoryIds) ? data.programCategoryIds : [];
        const has = cur.includes(c.id);
        const next = has ? cur.filter((x) => x !== c.id) : [...cur, c.id];
        onChange({ programCategoryIds: next });
      },
      className: "!min-h-[2.25rem] !px-3 !text-[13px]",
    }));
  }, [rootCategories, primaryLeafId, data.programCategoryIds, isEditable, loading, onChange]);

  // Enforce UI rules: if primary doesn't support program → clear selection.
  useEffect(() => {
    if (supportsProgram) return;
    if ((data.programCategoryIds ?? []).length > 0) {
      onChange({ programCategoryIds: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportsProgram]);

  // When primary category changes: remove invalid/duplicate ids and primary itself.
  useEffect(() => {
    if (!supportsProgram) return;
    const allowed = new Set(programSelectableItems.map((x) => x.id));
    const cur = Array.isArray(data.programCategoryIds) ? data.programCategoryIds : [];
    const deduped = Array.from(new Set(cur));
    const next = deduped.filter((id) => allowed.has(id));
    if (next.length !== cur.length || next.some((id, i) => id !== cur[i])) {
      onChange({ programCategoryIds: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportsProgram, primaryLeafId, programSelectableItems.map((x) => x.id).join("|")]);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ title: straightQuotesToGuillemets(e.target.value) });
  };

  const selectedEventFormats = data.eventFormats;
  const selectedEventFormatsSet = useMemo(
    () => new Set<EventFormatPreset>(selectedEventFormats),
    [selectedEventFormats],
  );

  const toggleEventFormat = (value: EventFormatPreset) => {
    const has = selectedEventFormatsSet.has(value);
    const next = has
      ? selectedEventFormats.filter((v) => v !== value)
      : [...selectedEventFormats, value];
    onChange({ eventFormats: next });
  };

  const isEventFormatDisabled = (value: EventFormatPreset) => {
    // Active chip always clickable to toggle off
    if (selectedEventFormatsSet.has(value)) return false;

    // Max 2 selections
    if (selectedEventFormats.length >= 2) return true;

    // Disallow calm + active
    if (selectedEventFormatsSet.has("calm_relaxed") && value === "active_energetic") {
      return true;
    }
    if (selectedEventFormatsSet.has("active_energetic") && value === "calm_relaxed") {
      return true;
    }

    return false;
  };

  const atmosphereItems: ChipItem[] = EVENT_FORMAT_OPTIONS.map((opt) => {
    const active = selectedEventFormatsSet.has(opt.value);
    const disabled = isEventFormatDisabled(opt.value);

    return {
      id: opt.value,
      label: opt.label,
      active,
      disabled: !isEditable || disabled || loading,
      onClick: () => {
        if (!isEditable) return;
        if (loading) return;
        toggleEventFormat(opt.value);
      },
      // Disabled: хотим opacity 0.4; остальное оставляем на дефолтные стили ChipsRow,
      // чтобы атмосфера была 1:1 как "Категория".
      className: "disabled:!opacity-[0.4] disabled:!pointer-events-none",
    };
  });

  const formatItems: ChipItem[] = ACTIVITY_FORMAT_OPTIONS.map((option) => {
    const active = data.format === option.value;
    return {
      id: option.value,
      label: option.label,
      active,
      disabled: !isEditable || loading,
      onClick: () => {
        if (!isEditable || loading) return;
        onChange({ format: option.value });
      },
      className: "disabled:!opacity-[0.4] disabled:!pointer-events-none",
    };
  });

  const selectedFormat = getActivityFormatOption(data.format);

  const renderCategoryIcon = (iconKey: string | null | undefined) => {
    const key = iconKey?.trim() ?? "";
    if (!key) return null;

    // If it's likely an emoji/symbol -> render as text
    const isEmojiLike =
      /[\u{1F300}-\u{1FAFF}]/u.test(key) ||
      /[\u{2600}-\u{26FF}]/u.test(key) ||
      /[\u{2700}-\u{27BF}]/u.test(key);
    if (isEmojiLike || (key.length <= 2 && /[^A-Za-z0-9]/.test(key))) {
      return <span className="text-base leading-none">{key}</span>;
    }

    const IconComponent =
      (LucideIcons as unknown as Record<string, ComponentType<{ className?: string }>>)[key];
    if (IconComponent) {
      return <IconComponent className="w-4 h-4 text-gray-900" />;
    }

    // Fallback: first char
    return <span className="text-base leading-none">{key.slice(0, 1)}</span>;
  };

  const handleRootCategoryChange = (rootId: string) => {
    if (!rootId) {
      onChange({
        categoryIds: [],
        subcategoryIdsByCategoryId: {},
        categoryId: null,
        subcategoryId: null,
        categorySlug: null,
        categoryPathLabel: null,
        genreSlugByRootCategoryId: {},
        cinemaGenre: "",
        programCategoryIds: [],
        primaryRootHasChildren: false,
      });
      return;
    }
    const cat = rootCategories.find((c) => c.id === rootId);
    if (!cat) return;
    const hasChildren = (cat.children?.length ?? 0) > 0;
    onChange({
      categoryIds: [cat.id],
      categoryId: cat.id,
      subcategoryId: null,
      subcategoryIdsByCategoryId: { [cat.id]: [] },
      categorySlug: hasChildren ? null : cat.slug,
      categoryPathLabel: hasChildren ? null : cat.nameRu,
      genreSlugByRootCategoryId: {},
      cinemaGenre: "",
      programCategoryIds: [],
      primaryRootHasChildren: hasChildren,
    });
  };

  const handleSubcategoryChange = (childId: string) => {
    const root = primaryRoot;
    if (!root || !data.categoryId) return;
    if (!childId) {
      onChange({
        subcategoryId: null,
        subcategoryIdsByCategoryId: { [root.id]: [] },
        categorySlug: root.slug,
        categoryPathLabel: root.nameRu,
      });
      return;
    }
    const child = root.children?.find((c) => c.id === childId);
    onChange({
      subcategoryId: childId,
      subcategoryIdsByCategoryId: { [root.id]: [childId] },
      categorySlug: child?.slug ?? null,
      categoryPathLabel: child?.nameRu ?? null,
    });
  };

  const rootSelectOptions = useMemo(
    () =>
      rootCategories.map((c) => ({
        value: c.id,
        label: c.nameRu,
      })),
    [rootCategories],
  );

  const subSelectOptions = useMemo(() => {
    const ch = primaryRoot?.children ?? [];
    return ch.map((c) => ({ value: c.id, label: c.nameRu }));
  }, [primaryRoot]);

  useEffect(() => {
    if (!isEditable) return;
    if (ageDetection.confidence !== "high") return;
    if (data.ageDetectionUserOverride) return;
    if (ageDetection.suggestedBuckets.length === 0) return;

    const next = sortAgeKeys([...ageDetection.suggestedBuckets]);
    const current = sortAgeKeys([...(data.ageRangeIds ?? [])]);
    if (current.join("|") === next.join("|") && data.ageDetectionAutoApplied) return;

    onChange({
      ageRangeIds: next,
      ageTags: next,
      ageDetectionAutoApplied: true,
    });
  }, [
    ageDetection.confidence,
    ageDetection.suggestedBuckets,
    data.ageDetectionAutoApplied,
    data.ageDetectionUserOverride,
    data.ageRangeIds,
    isEditable,
    onChange,
  ]);

  const applyAgeBuckets = (
    buckets: string[],
    {
      userOverride,
      autoApplied,
    }: {
      userOverride: boolean;
      autoApplied: boolean;
    },
  ) => {
    const next = sortAgeKeys([...buckets]);
    // Keep `ageTags` synchronized for existing Activity.ai/recommendations pipeline
    onChange({
      ageRangeIds: next,
      ageTags: next,
      ageDetectionUserOverride: userOverride,
      ageDetectionAutoApplied: autoApplied,
    });
  };

  const toggleAge = (ageValue: string) => {
    const next = data.ageRangeIds.includes(ageValue)
      ? data.ageRangeIds.filter((v) => v !== ageValue)
      : [...data.ageRangeIds, ageValue];
    applyAgeBuckets(next, { userOverride: true, autoApplied: false });
  };

  const clearAgeSelection = () => {
    onChange({
      ageRangeIds: [],
      ageTags: [],
      ageDetectionUserOverride: true,
      ageDetectionAutoApplied: false,
    });
  };

  const selectedInterestIds = data.interestIds ?? [];

  const toggleInterest = (interestValue: string) => {
    const isActive = selectedInterestIds.includes(interestValue);
    if (isActive) {
      const next = selectedInterestIds.filter((v) => v !== interestValue);
      onChange({ interestIds: next });
      return;
    }

    // Max 3 interests
    if (selectedInterestIds.length >= 3) return;

    onChange({ interestIds: [...selectedInterestIds, interestValue] });
  };

  const suggestedAgeLabel =
    ageDetection.suggestedBuckets.length > 0
      ? ageOptions
          .filter((option) => ageDetection.suggestedBuckets.includes(option.value))
          .map((option) => option.label)
          .join(", ")
      : "";

  const normalizedAgeLabel = ageDetection.normalizedLabel ?? ageDetection.raw;
  const isExactParsedRange =
    ageDetection.parsedMinAge != null && ageDetection.parsedMaxAge != null;
  const hasSuggestedAgeBuckets = ageDetection.suggestedBuckets.length > 0;
  const hasAppliedAgeBuckets = data.ageRangeIds.length > 0;
  const isAutoAppliedAge =
    data.ageDetectionAutoApplied &&
    ageDetection.confidence === "high" &&
    hasAppliedAgeBuckets;
  const showSuggestedAgePreview =
    hasSuggestedAgeBuckets &&
    !hasAppliedAgeBuckets &&
    !isAutoAppliedAge &&
    !data.ageDetectionUserOverride &&
    (ageDetection.confidence === "high" || ageDetection.confidence === "medium");

  const ageItems: ChipItem[] = ageOptions.map((o) => {
    const isActive = data.ageRangeIds.includes(o.value);
    const isPreview =
      showSuggestedAgePreview && ageDetection.suggestedBuckets.includes(o.value);

    return {
      id: o.value,
      label: o.label,
      active: isActive,
      disabled: !isEditable || loading,
      onClick: () => isEditable && toggleAge(o.value),
      className: isPreview && !isActive
        ? "!border-amber-300 !bg-transparent !text-amber-900"
        : undefined,
    };
  });

  const interestItems: ChipItem[] = interestOptions.map((o) => {
    const active = selectedInterestIds.includes(o.value);
    const disabled =
      !isEditable || loading || (!active && selectedInterestIds.length >= 3);

    return {
      id: o.value,
      label: o.label,
      active,
      disabled,
      onClick: () => isEditable && toggleInterest(o.value),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Основная информация</h2>
        <p className="text-[12px] text-muted-foreground">
          Название, формат, интересы, возраст и категория события
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Название <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          value={data.title}
          onChange={handleTitleChange}
          placeholder="Введите название события"
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-2">
        <div>
          <Label>
            Формат участия <span className="text-red-500">*</span>
          </Label>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Как пользователь может участвовать в событии
          </p>
        </div>
        <ChipsRow layout="wrap" aria-label="Формат участия" items={formatItems} />
        <div className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2 text-[12px] text-orange-950">
          <selectedFormat.icon className="h-4 w-4 shrink-0 text-orange-500" />
          <span>{selectedFormat.description}</span>
        </div>
      </div>

      {/* Event format / atmosphere — multi select */}
      <div className="space-y-2">
        <div>
          <Label>
            Как проходит событие <span className="text-red-500">*</span>
          </Label>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Выберите формат и атмосферу события
          </p>
        </div>
        <ChipsRow
          layout="wrap"
          aria-label="Как проходит событие"
          items={atmosphereItems}
        />
      </div>

      {/* Interests — multi select (max 3) */}
      <div className="space-y-2">
        <div>
          <Label>
            Интересы
          </Label>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Что больше всего отражает это событие
          </p>
        </div>
        <ChipsRow layout="wrap" aria-label="Интересы" items={interestItems} />
      </div>

      {/* Age groups — multi select */}
      <div className="space-y-2">
        <div>
          <Label>
            Возрастные группы <span className="text-red-500">*</span>
          </Label>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Для кого подходит это событие
          </p>
        </div>
        {ageDetection.confidence === "high" && ageDetection.raw && isAutoAppliedAge ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[12px] text-emerald-900">
            <p className="font-medium">
              Автоматически выбрано: {normalizedAgeLabel ?? ageDetection.raw}{" "}
              <span className="font-normal">(можно изменить)</span>
            </p>
            {!isExactParsedRange && suggestedAgeLabel ? (
              <p className="mt-0.5 text-emerald-800/90">Выбраны группы: {suggestedAgeLabel}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearAgeSelection}
                disabled={!isEditable}
                className="text-[12px] font-medium text-emerald-900 underline underline-offset-2 disabled:opacity-50"
              >
                Очистить выбор
              </button>
            </div>
          </div>
        ) : null}
        {ageDetection.confidence === "high" && ageDetection.raw && !isAutoAppliedAge ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
            <p className="font-medium">
              Найдена точная рекомендация: {normalizedAgeLabel ?? ageDetection.raw}
            </p>
            <p className="mt-0.5 text-amber-900/90">
              Это рекомендация, а не выбранное значение. При необходимости примените или измените вручную.
            </p>
            {!isExactParsedRange && suggestedAgeLabel ? (
              <p className="mt-0.5 text-amber-900/80">Рекомендуемые группы: {suggestedAgeLabel}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  applyAgeBuckets(ageDetection.suggestedBuckets, {
                    userOverride: true,
                    autoApplied: false,
                  })
                }
                disabled={!isEditable || ageDetection.suggestedBuckets.length === 0}
                className="font-medium text-amber-950 underline underline-offset-2 disabled:opacity-50"
              >
                Применить
              </button>
              <button
                type="button"
                onClick={clearAgeSelection}
                disabled={!isEditable}
                className="font-medium text-amber-950 underline underline-offset-2 disabled:opacity-50"
              >
                Очистить выбор
              </button>
            </div>
          </div>
        ) : null}
        {ageDetection.confidence === "medium" && ageDetection.raw ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
            <p className="font-medium">Есть рекомендация по возрасту</p>
            <p className="mt-0.5 text-amber-900/90">
              Найдено: {ageDetection.raw}. Подтвердите вручную.
            </p>
            {suggestedAgeLabel ? (
              <p className="mt-0.5 text-amber-900/80">Рекомендуем: {suggestedAgeLabel}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  applyAgeBuckets(ageDetection.suggestedBuckets, {
                    userOverride: true,
                    autoApplied: false,
                  })
                }
                disabled={!isEditable || ageDetection.suggestedBuckets.length === 0}
                className="font-medium text-amber-950 underline underline-offset-2 disabled:opacity-50"
              >
                Применить
              </button>
              <button
                type="button"
                onClick={clearAgeSelection}
                disabled={!isEditable}
                className="font-medium text-amber-950 underline underline-offset-2 disabled:opacity-50"
              >
                Очистить выбор
              </button>
            </div>
          </div>
        ) : null}
        {ageDetection.confidence === "none" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-700">
            Возраст не указан. Выберите вручную.
          </div>
        ) : null}
        {ageDetection.confidence === "low" && ageDetection.raw ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-700">
            Возраст найден, но распознан неуверенно: {ageDetection.raw}. Выберите вручную.
          </div>
        ) : null}
        <ChipsRow
          layout="wrap"
          aria-label="Возрастные группы"
          items={ageItems}
        />
      </div>

      {/* Основная категория — одиночный выбор */}
      <div className="space-y-2 w-full">
        <div>
          <Label htmlFor="event-primary-category">
            Основная категория <span className="text-red-500">*</span>
          </Label>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Определяет тип события (что это вообще)
          </p>
        </div>
        <FilterSelect
          id="event-primary-category"
          aria-label="Основная категория события"
          value={data.categoryId ?? ""}
          options={rootSelectOptions}
          onChange={handleRootCategoryChange}
          placeholder="Выберите основную категорию"
          disabled={!isEditable || loading}
        />

        {primaryRoot != null && (primaryRoot.children?.length ?? 0) > 0 ? (
          <div className="space-y-1 pt-1">
            <Label htmlFor="event-primary-subcategory" className="text-xs">
              Подкатегория <span className="text-red-500">*</span>
            </Label>
            <FilterSelect
              id="event-primary-subcategory"
              aria-label="Подкатегория"
              value={data.subcategoryId ?? ""}
              options={subSelectOptions}
              onChange={handleSubcategoryChange}
              placeholder="Выберите подкатегорию"
              disabled={!isEditable || loading}
            />
          </div>
        ) : null}

        {primaryRoot != null && data.categoryId ? (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            {(() => {
              const cat = primaryRoot;
              const genresForCat = genresByCategoryId[cat.id] ?? [];
              const hasGenresForCat = genresForCat.length > 0;
              const genreMap = data.genreSlugByRootCategoryId ?? {};
              const genreItemsForCat: ChipItem[] = genresForCat.map((g) => {
                const selectedSlug = genreMap[cat.id]?.trim() ?? "";
                const chipActive = selectedSlug === g.slug || selectedSlug === g.title;
                return {
                  id: g.id,
                  label: g.title,
                  active: chipActive,
                  disabled: !isEditable || loading,
                  onClick: () => {
                    if (!isEditable || loading) return;
                    const next = { ...genreMap };
                    if (chipActive) {
                      delete next[cat.id];
                    } else {
                      next[cat.id] = g.slug;
                    }
                    onChange({
                      genreSlugByRootCategoryId: next,
                      ...(isCinemaEventCategorySlug(cat.slug)
                        ? { cinemaGenre: next[cat.id] ?? "" }
                        : {}),
                    });
                  },
                  className: "!min-h-[2.25rem] !px-3 !text-[13px]",
                };
              });

              const canShowCinema =
                isCinemaEventCategorySlug(data.categorySlug) ||
                isCinemaEventCategorySlug(cat.slug);

              return (
                <>
                  {hasGenresForCat ? (
                    <div className="space-y-2">
                      <Label className="text-xs">Жанр</Label>
                      <ChipsRow
                        layout="wrap"
                        aria-label={`Жанры — ${cat.nameRu}`}
                        items={genreItemsForCat}
                      />
                    </div>
                  ) : null}

                  {canShowCinema ? (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {renderCategoryIcon(cat.icon)}
                        <h3 className="font-medium text-sm">Дополнительно для кино</h3>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cinemaDuration" className="text-xs">
                          Продолжительность (минуты)
                        </Label>
                        <Input
                          id="cinemaDuration"
                          type="number"
                          value={data.cinemaDuration || ""}
                          onChange={(e) =>
                            onChange({
                              cinemaDuration: parseInt(e.target.value, 10) || undefined,
                            })
                          }
                          placeholder="90"
                          disabled={!isEditable}
                          className="!text-[13px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cinemaTrailerLink" className="text-xs">
                          Ссылка на трейлер
                        </Label>
                        <Input
                          id="cinemaTrailerLink"
                          value={data.cinemaTrailerUrl || ""}
                          onChange={(e) => onChange({ cinemaTrailerUrl: e.target.value })}
                          placeholder="https://youtube.com/..."
                          disabled={!isEditable}
                          className="!text-[13px]"
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}
      </div>

      {/* Program categories (conditional on primary category) */}
      {supportsProgram && (
        <div className="space-y-2">
          <div>
            <Label>Что будет в программе</Label>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Выберите, какие типы активностей входят в программу события
            </p>
          </div>
          <ChipsRow layout="wrap" aria-label="Категории программы" items={programSelectableItems} />
        </div>
      )}

    </div>
  );
}
