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

const MAX_SUBCATEGORIES = 3;

/** UI-only chip id — never stored. "Любой возраст" is represented by `ageTags: []`. */
const ANY_AGE_CHIP_ID = "__any_age__";

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
  const [showFullDescription, setShowFullDescription] = useState(false);
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
    // Reset subcategories when root changes
    setSubcategoryIds([]);
    const root = dbCategories?.find((r) => r.id === id);
    onChange({
      primaryCategoryId: id || null,
      subcategoryIds: [],
      // Keep legacy category field in sync with root slug
      category: root?.slug ?? "",
    });
  };

  const handleToggleSubcategory = (categoryId: string) => {
    if (!isEditable) return;
    const next = subcategoryIds.includes(categoryId)
      ? subcategoryIds.filter((id) => id !== categoryId)
      : subcategoryIds.length >= MAX_SUBCATEGORIES
        ? subcategoryIds // guard — no change
        : [...subcategoryIds, categoryId];
    if (next === subcategoryIds) return; // nothing changed
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
      ? ageTags.filter((t) => t !== tag)
      : [...ageTags, tag];
    // If every known age ended up selected, that's the same thing as "any
    // age" — collapse back to [] so storage never has two representations
    // of the same "no restriction" meaning.
    const newTags = canonicalizeAgeTags(rawTags);
    setAgeTags(newTags);
    onChange({ ageTags: newTags });
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

  // Subcategory chips
  const subCategoryItems: ChipItem[] = useMemo(() => {
    if (!primaryRoot || primaryRoot.children.length === 0) return [];
    const atMax = subcategoryIds.length >= MAX_SUBCATEGORIES;
    return primaryRoot.children.map((child, idx) => {
      const isSelected = subcategoryIds.includes(child.id);
      const isMain = subcategoryIds[0] === child.id;
      const isDisabled = !isEditable || (!isSelected && atMax);

      const label = isMain ? (
        <span className="flex items-center gap-1.5">
          {child.nameRu}
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-white/95 rounded px-1 py-0.5 leading-none">
            Основная
          </span>
        </span>
      ) : (
        child.nameRu
      );

      return {
        id: child.id,
        label,
        active: isSelected,
        disabled: isDisabled,
        onClick: () => handleToggleSubcategory(child.id),
        className: "!min-h-[2.25rem] !px-3 !text-[13px]",
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRoot, subcategoryIds, isEditable]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <Label htmlFor="title">Название *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Например: Кофейня на Ленина"
          className="mt-2"
          disabled={!isEditable}
        />
      </div>

      {/* Category */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="place-category">Категория *</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Основной тип места</p>
        </div>

        <FilterSelect
          id="place-category"
          aria-label="Основная категория места"
          value={primaryCategoryId}
          options={rootSelectOptions}
          onChange={handlePrimaryCategoryChange}
          placeholder="Выберите категорию"
          disabled={!isEditable || !dbCategories}
        />

        {/* Subcategories */}
        {primaryRoot && primaryRoot.children.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Подкатегории <span className="text-red-500">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {subcategoryIds.length}/{MAX_SUBCATEGORIES} выбрано
              </span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Выберите от 1 до {MAX_SUBCATEGORIES} подкатегорий. Первая выбранная — основная.
            </p>
            <ChipsRow
              layout="masonry"
              aria-label="Подкатегории места"
              items={subCategoryItems}
            />
            {subcategoryIds.length >= MAX_SUBCATEGORIES && (
              <p className="text-xs text-amber-600">
                Можно выбрать не больше {MAX_SUBCATEGORIES} подкатегорий
              </p>
            )}
          </div>
        )}
      </div>

      {/* Short description */}
      <div>
        <Label htmlFor="shortDesc">Короткое описание *</Label>
        <Input
          id="shortDesc"
          value={shortDesc}
          onChange={(e) => handleShortDescChange(e.target.value)}
          placeholder=""
          className="mt-2"
          maxLength={100}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {shortDesc.length}/100 символов
        </p>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Описание *</Label>
        <div className="mt-2">
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
          <RichDescriptionEditor
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Подробное описание места — расскажите о том, что здесь можно делать, какая атмосфера, что особенного..."
            disabled={!isEditable}
            minHeight={180}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Используйте форматирование для лучшей читаемости. Минимум 20 символов.
        </p>
      </div>

      {/* Age */}
      <div>
        <Label>Возраст *</Label>
        <div className="mt-2">
          <ChipsRow
            layout="masonry"
            items={[
              {
                id: ANY_AGE_CHIP_ID,
                label: "Любой возраст",
                // Derived, not separate state — ageTags=[] *is* "Любой возраст".
                // Selecting a specific age naturally clears this (ageTags becomes
                // non-empty); selecting this chip clears ageTags, which naturally
                // deactivates every specific-age chip. No dual-selection is possible.
                active: ageTags.length === 0,
                disabled: !isEditable,
                onClick: () => {
                  if (!isEditable || ageTags.length === 0) return;
                  setAgeTags([]);
                  onChange({ ageTags: [] });
                },
              },
              ...AGE_OPTIONS.map((ageOption): ChipItem => ({
                id: ageOption.key,
                label: ageOption.shortLabel,
                active: isPlaceAgeChipActive({ storedAgeTags: ageTags, chipAgeTag: ageOption.key }),
                disabled: !isEditable,
                onClick: () => isEditable && toggleAgeTag(ageOption.key),
              })),
            ]}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          «Любой возраст» означает, что место подходит детям всех возрастов.
        </p>
      </div>

      {/* Visit formats */}
      <div>
        <Label>Формат посещения *</Label>
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
  );
}
