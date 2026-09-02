"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { FilterSelect } from "@/components/ui/filter-select";
import { AGE_OPTIONS } from "@/lib/config/ages";
import { canonicalizeAgeTags, isPlaceAgeChipActive } from "../isPlaceAgeChipActive";
import { useVisitFormats, normalizeVisitFormats } from "@/hooks/useVisitFormats";
import { RichDescriptionEditor } from "@/components/editor/RichDescriptionEditor";
import { plainTextToRichTextHtml } from "@/lib/richtext/utils";
import { AiDescriptionAssistant } from "@/components/ai/AiDescriptionAssistant";
import { generateSummary } from "@/lib/openingHours/openingHoursMapper";
import type { PlaceFormData } from "../types";
import { AgePolicy } from "@prisma/client";
import {
  addAdditionalSubcategory,
  deriveSubcategorySelection,
  MAX_ADDITIONAL_SUBCATEGORIES,
  removeAdditionalSubcategory,
  setPrimarySubcategory,
} from "../placeSubcategorySelection";

/** UI-only chip id — never stored. "Любой возраст" is represented by `ageTags: []`. */
const ANY_AGE_CHIP_ID = "__any_age__";
const ADULT_SUITABILITY_AGE_TAG = "18+";

type PlaceCategoryChild = {
  id: string;
  nameRu: string;
  slug: string;
  sortOrder: number;
  parentId: string;
};

type PlaceCategoryRoot = {
  id: string;
  nameRu: string;
  slug: string;
  sortOrder: number;
  parentId: null;
  children: PlaceCategoryChild[];
};

interface Step1ProfileProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step1Profile({ data, onChange, isEditable = true }: Step1ProfileProps) {
  const normalizeDescriptionForEditor = (value: string | null | undefined) => {
    const raw = value || "";
    return raw && !/<[a-z][\s\S]*>/i.test(raw) ? plainTextToRichTextHtml(raw) : raw;
  };

  const [title, setTitle] = useState(() => data.title);
  const [shortDesc, setShortDesc] = useState(() => data.shortDesc);
  const [description, setDescription] = useState(() => normalizeDescriptionForEditor(data.description));
  const [ageTags, setAgeTags] = useState<string[]>(() => data.ageTags || []);
  // Normalize legacy values (indoor → format-indoor) on init
  const [visitFormats, setVisitFormats] = useState<string[]>(() =>
    normalizeVisitFormats(data.visitFormats || [])
  );

  // Load visit formats from taxonomy
  const { formats: visitFormatOptions, isLoading: formatsLoading } = useVisitFormats("PLACE");

  // Category state
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>(() => data.primaryCategoryId ?? "");
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>(() => data.subcategoryIds ?? []);

  // Categories from DB
  const [dbCategories, setDbCategories] = useState<PlaceCategoryRoot[] | null>(null);

  useEffect(() => {
    setTitle(data.title);
  }, [data.title]);

  useEffect(() => {
    setShortDesc(data.shortDesc);
  }, [data.shortDesc]);

  useEffect(() => {
    setDescription(normalizeDescriptionForEditor(data.description));
  }, [data.description]);

  useEffect(() => {
    setAgeTags(data.ageTags || []);
  }, [data.ageTags]);

  useEffect(() => {
    setVisitFormats(normalizeVisitFormats(data.visitFormats || []));
  }, [data.visitFormats]);

  useEffect(() => {
    setPrimaryCategoryId(data.primaryCategoryId ?? "");
  }, [data.primaryCategoryId]);

  useEffect(() => {
    setSubcategoryIds(data.subcategoryIds ?? []);
  }, [data.subcategoryIds]);

  useEffect(() => {
    fetch("/api/public/place-categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (Array.isArray(json?.categories) && json.categories.length > 0) {
          setDbCategories(json.categories as PlaceCategoryRoot[]);
        }
      })
      .catch(() => {});
  }, []);

  // Handlers
  const handleTitleChange = (value: string) => {
    setTitle(value);
    onChange({ title: value });
  };

  const handlePrimaryCategoryChange = (id: string) => {
    setPrimaryCategoryId(id);
    // Reset subcategory selection when the root category changes — a
    // subcategory only makes sense within its own root.
    setSubcategoryIds([]);
    const root = dbCategories?.find((r) => r.id === id);
    onChange({
      primaryCategoryId: id || null,
      subcategoryIds: [],
      // Keep legacy category field in sync with root slug
      category: root?.slug ?? "",
    });
  };

  const handlePrimarySubcategoryChange = (id: string) => {
    if (!isEditable) return;
    const next = setPrimarySubcategory(subcategoryIds, id || null);
    if (next === subcategoryIds) return;
    setSubcategoryIds(next);
    onChange({ subcategoryIds: next });
  };

  const handleToggleAdditionalSubcategory = (id: string, isSelected: boolean) => {
    if (!isEditable) return;
    const next = isSelected
      ? removeAdditionalSubcategory(subcategoryIds, id)
      : addAdditionalSubcategory(subcategoryIds, id);
    if (next === subcategoryIds) return; // no-op — nothing changed (cap reached, duplicate, etc.)
    setSubcategoryIds(next);
    onChange({ subcategoryIds: next });
  };

  const handleShortDescChange = (value: string) => {
    setShortDesc(value);
    onChange({ shortDesc: value });
  };

  const handleDescriptionChange = (html: string) => {
    setDescription(html);
    onChange({ description: html });
  };

  const toggleAgeTag = (tag: string) => {
    const rawTags = ageTags.includes(tag)
      ? ageTags.filter((value) => value !== tag)
      : [...ageTags, tag];
    const newTags = canonicalizeAgeTags(rawTags);
    setAgeTags(newTags);
    onChange({
      ageTags: newTags,
      agePolicy: newTags.length ? AgePolicy.SPECIFIC : AgePolicy.UNRESTRICTED,
    });
  };

  const toggleVisitFormat = (format: string) => {
    const newFormats = visitFormats.includes(format)
      ? visitFormats.filter((f) => f !== format)
      : [...visitFormats, format];
    setVisitFormats(newFormats);
    onChange({ visitFormats: newFormats });
  };
  // Dropdown options for root categories
  const rootSelectOptions = useMemo(
    () => (dbCategories ?? []).map((c) => ({ value: c.id, label: c.nameRu })),
    [dbCategories],
  );

  // Current root category
  const primaryRoot = useMemo(
    () => dbCategories?.find((r) => r.id === primaryCategoryId) ?? null,
    [dbCategories, primaryCategoryId],
  );

  // Primary/additional split of the stored subcategoryIds array — index 0
  // is always primary, the rest are additional (see placeSubcategorySelection.ts).
  const subcategorySelection = useMemo(
    () => deriveSubcategorySelection(subcategoryIds),
    [subcategoryIds],
  );

  // "Основная подкатегория" dropdown offers every child of the selected root.
  const primarySubcategoryOptions = useMemo(
    () => (primaryRoot?.children ?? []).map((c) => ({ value: c.id, label: c.nameRu })),
    [primaryRoot],
  );

  // "Дополнительные подкатегории" chips — every child except whichever is
  // currently primary.
  const additionalSubcategoryItems: ChipItem[] = useMemo(() => {
    if (!primaryRoot || primaryRoot.children.length === 0) return [];
    const atMax = subcategorySelection.additional.length >= MAX_ADDITIONAL_SUBCATEGORIES;
    return primaryRoot.children
      .filter((child) => child.id !== subcategorySelection.primary)
      .map((child) => {
        const isSelected = subcategorySelection.additional.includes(child.id);
        return {
          id: child.id,
          label: child.nameRu,
          active: isSelected,
          disabled: !isEditable || (!isSelected && atMax),
          onClick: () => handleToggleAdditionalSubcategory(child.id, isSelected),
          className: "!min-h-[2.25rem] !px-3 !text-[13px]",
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRoot, subcategorySelection, isEditable]);

  return (
    <div className="space-y-6">
      {/* Название */}
      <div>
        <Label htmlFor="title">Название *</Label>
        <p className="text-xs text-muted-foreground mt-0.5">Как место называется для посетителей</p>
        <Input
          id="title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Детский центр «Совёнок»"
          className="mt-2"
          disabled={!isEditable}
        />
      </div>

      {/* Тип места */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Тип места</h3>

        <div>
          <Label htmlFor="place-category">Категория *</Label>
          <FilterSelect
            id="place-category"
            aria-label="Категория места"
            value={primaryCategoryId}
            options={rootSelectOptions}
            onChange={handlePrimaryCategoryChange}
            placeholder="Выберите категорию"
            disabled={!isEditable || !dbCategories}
            className="mt-2"
          />
        </div>

        {primaryRoot && primaryRoot.children.length > 0 && (
          <>
            <div>
              <Label htmlFor="primary-subcategory">Основная подкатегория *</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Это главный тип места — он влияет на то, как место показывается пользователям.
              </p>
              <FilterSelect
                id="primary-subcategory"
                aria-label="Основная подкатегория места"
                value={subcategorySelection.primary ?? ""}
                options={primarySubcategoryOptions}
                onChange={handlePrimarySubcategoryChange}
                placeholder="Выберите основную подкатегорию"
                disabled={!isEditable}
                className="mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Дополнительные подкатегории</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Можно добавить ещё до {MAX_ADDITIONAL_SUBCATEGORIES} подходящих вариантов.
              </p>
              <ChipsRow
                layout="masonry"
                aria-label="Дополнительные подкатегории места"
                items={additionalSubcategoryItems}
              />
            </div>
          </>
        )}
      </div>

      {/* Описание */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Описание</h3>

        <div>
          <Label htmlFor="shortDesc">Коротко о месте *</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            1–2 предложения, которые помогут быстро понять, зачем сюда идти.
          </p>
          <Input
            id="shortDesc"
            value={shortDesc}
            onChange={(e) => handleShortDescChange(e.target.value)}
            placeholder=""
            className="mt-2"
            maxLength={100}
            disabled={!isEditable}
          />
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {shortDesc.length}/100 символов
          </p>
        </div>

        <div>
          <Label htmlFor="description">Подробнее о месте *</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Расскажите, чем здесь можно заняться, что особенно понравится семьям и что стоит знать
            перед посещением.
          </p>
          <div className="mt-2">
            <RichDescriptionEditor
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Чем здесь можно заняться, какая атмосфера, что особенного..."
              disabled={!isEditable}
              minHeight={180}
            />
            <div className="mt-3">
              <AiDescriptionAssistant
                entityType="place"
                title={title}
                value={description}
                isEditable={isEditable}
                onApply={handleDescriptionChange}
                filledActions={["improve", "shorten", "warm"]}
                context={{
                  shortDescription: shortDesc,
                  category: primaryRoot?.nameRu || data.category,
                  subcategories: primaryRoot?.children
                    .filter((child) => subcategoryIds.includes(child.id))
                    .map((child) => child.nameRu),
                  ageRange: ageTags,
                  visitFormats,
                  address: data.customAddress || data.formattedAddr,
                  workingHours: data.openingHoursData ? generateSummary(data.openingHoursData) : "",
                  amenities: data.priceItems.items.map((item) => item.label),
                  website: data.website,
                  instagram: data.instagramHandle || data.instagramUrl,
                  phone: data.phone,
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Используйте форматирование для лучшей читаемости. Минимум 20 символов.
          </p>
        </div>
      </div>

      {/* Для кого */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Для кого</h3>

        <div>
          <Label>Для какого возраста подходит? *</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Выберите общий возраст посетителей. У отдельных событий и предложений возраст может
            отличаться.
          </p>
          <div className="mt-2">
            <ChipsRow
              layout="masonry"
              items={[
                {
                  id: ANY_AGE_CHIP_ID,
                  label: "Любой возраст",
                  active: data.agePolicy === AgePolicy.UNRESTRICTED,
                  disabled: !isEditable,
                  onClick: () => {
                    if (!isEditable) return;
                    if (data.agePolicy === AgePolicy.UNRESTRICTED && ageTags.length === 0) return;
                    setAgeTags([]);
                    onChange({ ageTags: [], agePolicy: AgePolicy.UNRESTRICTED });
                  },
                },
                ...AGE_OPTIONS.map((ageOption): ChipItem => ({
                  id: ageOption.key,
                  // The shared catalog historically labels 18+ as #nokids, but
                  // in the discriminated Place policy 18+ is ordinary suitability.
                  label:
                    ageOption.key === ADULT_SUITABILITY_AGE_TAG
                      ? "18+"
                      : ageOption.shortLabel,
                  active:
                    data.agePolicy === AgePolicy.SPECIFIC &&
                    isPlaceAgeChipActive({
                      storedAgeTags: ageTags,
                      chipAgeTag: ageOption.key,
                    }),
                  disabled: !isEditable,
                  onClick: () => isEditable && toggleAgeTag(ageOption.key),
                })),
                {
                  id: "adult-only",
                  label: "Только 18+",
                  active: data.agePolicy === AgePolicy.ADULT_ONLY,
                  disabled: !isEditable,
                  onClick: () => {
                    if (!isEditable) return;
                    setAgeTags([]);
                    onChange({ ageTags: [], agePolicy: AgePolicy.ADULT_ONLY });
                  },
                },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            «18+» — подходит взрослым; «Только 18+» — строгая возрастная граница.
          </p>
        </div>

        <div>
          <Label>Как можно посетить место? *</Label>
          <div className="mt-2">
            <ChipsRow
              layout="masonry"
              items={visitFormatOptions.map((option): ChipItem => ({
                id: option.value,
                label: option.label,
                active: visitFormats.includes(option.value),
                disabled: !isEditable || formatsLoading,
                onClick: () => isEditable && toggleVisitFormat(option.value),
              }))}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Выберите хотя бы один формат посещения
          </p>
        </div>
      </div>
    </div>
  );
}
