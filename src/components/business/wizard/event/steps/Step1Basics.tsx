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
import { CircleCheckBig } from "lucide-react";
import type { ComponentType } from "react";

type DiscoveryEventCategory = {
  id: string;
  nameRu: string;
  slug: string;
  icon?: string | null;
  parentId: string | null;
  sortOrder: number;
  children?: DiscoveryEventCategory[];
};

type PublicAgeOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
};

type PublicInterestOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
};

type PublicGenreOption = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

interface Step1BasicsProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

export function Step1Basics({ data, onChange, isEditable }: Step1BasicsProps) {
  const [rootCategories, setRootCategories] = useState<DiscoveryEventCategory[]>([]);
  const [ageOptions, setAgeOptions] = useState<PublicAgeOption[]>([]);
  const [interestOptions, setInterestOptions] = useState<PublicInterestOption[]>([]);
  const [genreOptions, setGenreOptions] = useState<PublicGenreOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [catRes, ageRes, interestsRes, genreRes] = await Promise.all([
          fetch("/api/public/event-categories").then((r) => r.json()),
          fetch("/api/public/signals/age").then((r) => r.json()),
          fetch("/api/public/signals/interests")
            .then((r) => r.json())
            .catch(() => null),
          fetch("/api/public/genres").then((r) => r.json()),
        ]);

        if (!alive) return;

        const cats: DiscoveryEventCategory[] = Array.isArray(catRes?.categories)
          ? (catRes.categories as DiscoveryEventCategory[])
          : [];
        const ages: PublicAgeOption[] = Array.isArray(ageRes?.options)
          ? (ageRes.options as PublicAgeOption[])
          : [];

        const interests: PublicInterestOption[] = Array.isArray(
          (interestsRes as any)?.options,
        )
          ? ((interestsRes as any).options as PublicInterestOption[])
          : [];

        const genres: PublicGenreOption[] = Array.isArray(genreRes?.genres)
          ? (genreRes.genres as PublicGenreOption[])
          : [];

        // Security: keep only active categories/ages (server should already do this)
        setRootCategories(cats);
        setAgeOptions(ages.filter((o) => o.active).sort((a, b) => a.order - b.order));
        setInterestOptions(
          interests.filter((o) => o.active).sort((a, b) => a.order - b.order),
        );
        setGenreOptions(genres.filter((g) => g.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        if (!alive) return;
        setRootCategories([]);
        setAgeOptions([]);
        setInterestOptions([]);
        setGenreOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const effectiveCategoryIds = useMemo(() => {
    if (Array.isArray(data.categoryIds) && data.categoryIds.length > 0) {
      return data.categoryIds;
    }
    if (data.categoryId) return [data.categoryId];
    return [];
  }, [data.categoryIds, data.categoryId]);

  const effectiveSubcategoryMap = useMemo(() => {
    const base = data.subcategoryIdsByCategoryId ?? {};
    const next: Record<string, string[]> = { ...base };
    if (Object.keys(next).length === 0 && data.categoryId) {
      next[data.categoryId] = data.subcategoryId ? [data.subcategoryId] : [];
    }
    return next;
  }, [data.subcategoryIdsByCategoryId, data.categoryId, data.subcategoryId]);

  const primaryRootId = effectiveCategoryIds[0] ?? null;

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ title: e.target.value });
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

  const handleToggleRootCategory = (cat: DiscoveryEventCategory) => {
    const isActive = effectiveCategoryIds.includes(cat.id);
    const categoryIds = effectiveCategoryIds;
    const subcategoryMap = effectiveSubcategoryMap;

    if (isActive) {
      const nextCategoryIds = categoryIds.filter((id) => id !== cat.id);
      const nextMap: Record<string, string[]> = { ...subcategoryMap };
      delete nextMap[cat.id];

      const nextPrimaryRootId = nextCategoryIds[0] ?? null;

      if (!nextPrimaryRootId) {
        onChange({
          categoryIds: [],
          subcategoryIdsByCategoryId: {},
          categoryId: null,
          subcategoryId: null,
          categorySlug: null,
          categoryPathLabel: null,
        });
        return;
      }

      const nextPrimaryRoot = rootCategories.find((c) => c.id === nextPrimaryRootId) ?? null;
      const nextPrimarySubIds = nextMap[nextPrimaryRootId] ?? [];
      const nextPrimarySubId = nextPrimarySubIds[0] ?? null;

      const nextLeaf =
        nextPrimaryRoot && nextPrimarySubId
          ? nextPrimaryRoot.children?.find((ch) => ch.id === nextPrimarySubId) ?? null
          : null;

      onChange({
        categoryIds: nextCategoryIds,
        subcategoryIdsByCategoryId: nextMap,
        categoryId: nextPrimaryRootId,
        subcategoryId: nextPrimarySubId,
        categorySlug: nextLeaf?.slug ?? nextPrimaryRoot?.slug ?? null,
        categoryPathLabel: nextLeaf?.nameRu ?? nextPrimaryRoot?.nameRu ?? null,
      });

      return;
    }

    // Add new root category (max 3)
    if (categoryIds.length >= 3) return;

    const nextCategoryIds = [...categoryIds, cat.id];
    const nextMap: Record<string, string[]> = { ...subcategoryMap, [cat.id]: [] };

    // If nothing selected yet: initialize primary legacy fields
    if (!data.categoryId) {
      onChange({
        categoryIds: nextCategoryIds,
        subcategoryIdsByCategoryId: nextMap,
        categoryId: cat.id,
        subcategoryId: null,
        categorySlug: cat.slug,
        categoryPathLabel: cat.nameRu,
      });
      return;
    }

    onChange({
      categoryIds: nextCategoryIds,
      subcategoryIdsByCategoryId: nextMap,
    });
  };

  const handleToggleSubcategory = (rootId: string, child: DiscoveryEventCategory) => {
    const subcategoryMap = effectiveSubcategoryMap;
    const currentSubIds = subcategoryMap[rootId] ?? [];
    const nextSubIds = currentSubIds.includes(child.id)
      ? currentSubIds.filter((id) => id !== child.id)
      : [...currentSubIds, child.id];

    const nextMap: Record<string, string[]> = { ...subcategoryMap, [rootId]: nextSubIds };

    // Update legacy primary fields if subcategory belongs to primary root
    if (rootId === primaryRootId) {
      const root = rootCategories.find((c) => c.id === rootId) ?? null;
      const primarySubId = nextSubIds[0] ?? null;
      const leaf =
        primarySubId && root?.children?.length
          ? root.children.find((ch) => ch.id === primarySubId) ?? null
          : null;

      onChange({
        subcategoryIdsByCategoryId: nextMap,
        subcategoryId: primarySubId,
        categorySlug: leaf?.slug ?? root?.slug ?? null,
        categoryPathLabel: leaf?.nameRu ?? root?.nameRu ?? null,
      });
      return;
    }

    onChange({ subcategoryIdsByCategoryId: nextMap });
  };

  const toggleAge = (ageValue: string) => {
    const next = data.ageRangeIds.includes(ageValue)
      ? data.ageRangeIds.filter((v) => v !== ageValue)
      : [...data.ageRangeIds, ageValue];
    // Keep `ageTags` synchronized for existing Activity.ai/recommendations pipeline
    onChange({ ageRangeIds: next, ageTags: next });
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

  const ageItems: ChipItem[] = ageOptions.map((o) => ({
    id: o.value,
    label: o.label,
    active: data.ageRangeIds.includes(o.value),
    disabled: !isEditable || loading,
    onClick: () => isEditable && toggleAge(o.value),
  }));

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

  const selectedGenre =
    data.cinemaGenre?.trim() && data.cinemaGenre.trim().length > 0
      ? data.cinemaGenre.trim()
      : "";

  const genreItems: ChipItem[] = genreOptions.map((g) => {
    const active = selectedGenre === g.slug || selectedGenre === g.title;
    return {
      id: g.id,
      label: g.title,
      active,
      disabled: !isEditable || loading,
      onClick: () => {
        if (!isEditable || loading) return;
        if (active) {
          onChange({ cinemaGenre: "" });
        } else {
          // Prefer slug as stable identifier
          onChange({ cinemaGenre: g.slug });
        }
      },
      // Compact style to match subcategory chips
      className: "!min-h-[2.25rem] !px-3 !text-[13px]",
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
        <ChipsRow
          layout="wrap"
          aria-label="Возрастные группы"
          items={ageItems}
        />
      </div>

      {/* Categories (cards with expand) */}
      <div className="space-y-2">
        <Label>
          Категория <span className="text-red-500">*</span>
        </Label>
        <p className="text-[12px] text-muted-foreground">
          Можно выбрать максимум 3 категории
        </p>

        <div className="grid grid-cols-1 gap-3">
          {rootCategories.map((cat) => {
            const isActive = effectiveCategoryIds.includes(cat.id);
            const isDisabled = !isActive && effectiveCategoryIds.length >= 3;
            const cardDisabled = !isEditable || loading || isDisabled;

            const children = cat.children ?? [];
            const selectedSubIds = effectiveSubcategoryMap[cat.id] ?? [];

            const subItems: ChipItem[] = children.map((child) => ({
              id: child.id,
              label: child.nameRu,
              active: selectedSubIds.includes(child.id),
              disabled: !isEditable || loading,
              onClick: () => {
                if (!isEditable || loading) return;
                handleToggleSubcategory(cat.id, child);
              },
              className: "!min-h-[2.25rem] !px-3 !text-[13px]",
            }));

            // Cinema extra fields belong to the «Кино» root category card whenever it is selected,
            // not only when it is the first selected category (multi-select up to 3).
            const canShowCinemaInThisCard =
              isActive && isCinemaEventCategorySlug(cat.slug);
            const hasExpandableContent =
              children.length > 0 || canShowCinemaInThisCard;

            return (
              <div
                key={cat.id}
                className={[
                  "rounded-xl border p-3 transition-colors bg-white",
                  isActive
                    ? "border-[#EF8759] bg-[#EF8759]/5"
                    : "border-gray-200 bg-white",
                  cardDisabled ? "opacity-40 pointer-events-none" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  disabled={cardDisabled}
                  className={[
                    "w-full text-left flex items-center justify-between gap-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/35 focus-visible:ring-offset-2 rounded-lg",
                  ].join(" ")}
                  onClick={() => handleToggleRootCategory(cat)}
                >
                  <span className="min-w-0 flex-1 flex items-center gap-2">
                    {renderCategoryIcon(cat.icon)}
                    <span className="font-medium text-sm text-gray-900 line-clamp-1">
                      {cat.nameRu}
                    </span>
                  </span>

                  <span
                    className={[
                      "shrink-0 inline-flex items-center justify-center rounded-full h-6 w-6 border transition-colors",
                      isActive
                        ? "bg-[#EF8759] border-[#EF8759]"
                        : "bg-white border-gray-200",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isActive && (
                      <CircleCheckBig className="w-3 h-3 text-white" aria-hidden />
                    )}
                  </span>
                </button>

                <div
                  className={[
                    "overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
                    isActive
                      ? `max-h-[800px] opacity-100 translate-y-0 ${
                          hasExpandableContent ? "pt-2" : ""
                        }`
                      : "max-h-0 opacity-0 -translate-y-1",
                  ].join(" ")}
                >
                  {isActive && (
                    <div className="space-y-3">
                      {children.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs">Подкатегории</Label>
                          <ChipsRow layout="wrap" aria-label={`Подкатегории ${cat.nameRu}`} items={subItems} />
                        </div>
                      )}

                      {canShowCinemaInThisCard && (
                        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                          <h3 className="font-medium text-sm">Дополнительно для кино</h3>

                          <div className="space-y-2">
                            <Label className="text-xs">Жанр</Label>
                            <ChipsRow layout="wrap" aria-label="Жанры" items={genreItems} />
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
                                  cinemaDuration:
                                    parseInt(e.target.value, 10) || undefined,
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
                              onChange={(e) =>
                                onChange({ cinemaTrailerUrl: e.target.value })
                              }
                              placeholder="https://youtube.com/..."
                              disabled={!isEditable}
                              className="!text-[13px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
