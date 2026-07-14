"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/button";
import { AGE_OPTIONS } from "@/lib/config/ages";
import { ImageGalleryUploader } from "@/components/image/ImageUploader";
import type { UploadedImage } from "@/hooks/useImageUpload";
import {
  RouteStopLocationInput,
  type RouteStopLocationValue,
} from "@/components/routes/RouteStopLocationInput";
import { deriveRouteCityFromStops } from "@/lib/routes/cityDerivation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  MapPin,
  Globe,
  Lock,
  Link2,
  Wallet,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useWizardDraft } from "@/hooks/useWizardDraft";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";
import { SaveIndicator, formatRelativeTimeRu } from "@/components/form-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  summarizeRouteBudget,
  type LegacyBudgetLevel,
  type RouteStopPriceType,
} from "@/lib/routes/routeBudget";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export type RouteEditorMode = "create" | "edit";

export type EditableRouteStop = {
  id: string;
  location: RouteStopLocationValue | null;
  customTitle?: string;
  note: string;
  photos?: UploadedImage[];
  priceType: RouteStopPriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  priceCurrency: string;
  priceNote: string;
};

export type WizardState = {
  title: string;
  ageTags: string[];
  budgetLevel: LegacyBudgetLevel | null;
  stops: EditableRouteStop[];
  visibility: Visibility;
};

export type RouteEditorProps = {
  mode: RouteEditorMode;
  routeId?: string;
  initialSlug?: string;
  initialState?: Partial<WizardState>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICE_TYPE_OPTIONS: {
  value: Exclude<RouteStopPriceType, "UNKNOWN">;
  label: string;
}[] = [
  { value: "FREE", label: "Бесплатно" },
  { value: "FIXED", label: "Цена" },
  { value: "RANGE", label: "Диапазон" },
  { value: "FROM", label: "От" },
  { value: "CUSTOM", label: "Другое" },
];

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  sub: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "PUBLIC",
    label: "Публичный",
    sub: "Виден всем в каталоге",
    icon: <Globe className="w-4 h-4" />,
  },
  {
    value: "UNLISTED",
    label: "По ссылке",
    sub: "Только по прямой ссылке",
    icon: <Link2 className="w-4 h-4" />,
  },
  {
    value: "PRIVATE",
    label: "Приватный",
    sub: "Только для вас",
    icon: <Lock className="w-4 h-4" />,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makeEmptyStop(): EditableRouteStop {
  return {
    id: `stop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    location: null,
    note: "",
    photos: [],
    priceType: "UNKNOWN",
    priceMin: null,
    priceMax: null,
    priceCurrency: "BYN",
    priceNote: "",
  };
}

const BASE_STATE: WizardState = {
  title: "",
  ageTags: [],
  budgetLevel: null,
  stops: [makeEmptyStop(), makeEmptyStop()],
  visibility: "PUBLIC",
};

/** Версия схемы черновика в localStorage; bump при несовместимом изменении WizardState */
const ROUTE_WIZARD_DRAFT_SCHEMA_VERSION = 1;

/** Пустую форму не автосохраняем */
function isMeaningfulRouteDraft(state: WizardState): boolean {
  return (
    state.title.trim().length > 0 ||
    state.ageTags.length > 0 ||
    state.budgetLevel !== null ||
    state.stops.some((s) => s.location !== null || s.note.trim().length > 0)
  );
}

function normalizeEditableStop(stop: EditableRouteStop): EditableRouteStop {
  return {
    ...stop,
    photos: stop.photos ?? [],
    priceType: stop.priceType ?? "UNKNOWN",
    priceMin: stop.priceMin ?? null,
    priceMax: stop.priceMax ?? null,
    priceCurrency: stop.priceCurrency || "BYN",
    priceNote: stop.priceNote ?? "",
  };
}

function parsePriceInput(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(",", ".");
  const next = Number(normalized);
  return Number.isFinite(next) && next >= 0 ? next : null;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              s === step
                ? "bg-neutral-900 text-white"
                : s < step
                  ? "bg-neutral-200 text-neutral-500"
                  : "bg-neutral-100 text-neutral-400",
            )}
          >
            {s}
          </div>
          {s < 3 && (
            <div
              className={cn(
                "flex-1 h-px",
                s < step ? "bg-neutral-300" : "bg-neutral-100",
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Step 1: Basics ───────────────────────────────────────────────────────────

function Step1({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const canContinue = state.title.trim().length >= 3;

  const toggleAge = (key: string) => {
    const next = state.ageTags.includes(key)
      ? state.ageTags.filter((k) => k !== key)
      : [...state.ageTags, key];
    onChange({ ageTags: next });
  };

  const allAgesSelected = state.ageTags.length === AGE_OPTIONS.length;
  const toggleAllAges = () => {
    onChange({
      ageTags: allAgesSelected ? [] : AGE_OPTIONS.map((opt) => opt.key),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">
          Основная информация
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Расскажите всем про ваш маршрут
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-2">
          Название маршрута
        </label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Например: Семейная суббота в центре"
          maxLength={80}
          className="w-full h-12 px-4 rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-2">
          Для кого
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleAllAges}
            className={cn(
              "px-3.5 py-2 rounded-xl text-sm font-medium transition-all border",
              allAgesSelected
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400",
            )}
          >
            Любой
          </button>
          {AGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleAge(opt.key)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-all border",
                state.ageTags.includes(opt.key)
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400",
              )}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-3">
        <p className="text-sm text-neutral-500">
          Бюджет маршрута соберём автоматически по стоимости каждой точки на
          следующем шаге.
        </p>
      </div>

      <div className="pt-2">
        <Button
          size="lg"
          className="w-full rounded-2xl font-semibold"
          disabled={!canContinue}
          onClick={onNext}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}

// ─── Stop Editor ──────────────────────────────────────────────────────────────

function StopPriceEditor({
  stop,
  onChange,
}: {
  stop: EditableRouteStop;
  onChange: (patch: Partial<EditableRouteStop>) => void;
}) {
  const selectType = (value: Exclude<RouteStopPriceType, "UNKNOWN">) => {
    const nextType = stop.priceType === value ? "UNKNOWN" : value;
    onChange({
      priceType: nextType,
      priceCurrency: stop.priceCurrency || "BYN",
      ...(nextType === "FREE"
        ? { priceMin: null, priceMax: null }
        : nextType === "FIXED"
          ? { priceMax: null }
          : nextType === "FROM"
            ? { priceMax: null }
            : nextType === "CUSTOM" || nextType === "UNKNOWN"
              ? { priceMin: null, priceMax: null }
              : {}),
    });
  };

  const currentType = stop.priceType ?? "UNKNOWN";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-neutral-600">
          <Wallet className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Стоимость</p>
          <p className="text-xs text-neutral-400">
            Можно оставить пусто и вернуться позже
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRICE_TYPE_OPTIONS.map((option) => {
          const active = currentType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectType(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {currentType === "FIXED" && (
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={stop.priceMin ?? ""}
          onChange={(e) => onChange({ priceMin: parsePriceInput(e.target.value) })}
          placeholder="Сумма"
          className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
        />
      )}

      {currentType === "RANGE" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={stop.priceMin ?? ""}
            onChange={(e) => onChange({ priceMin: parsePriceInput(e.target.value) })}
            placeholder="От"
            className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={stop.priceMax ?? ""}
            onChange={(e) => onChange({ priceMax: parsePriceInput(e.target.value) })}
            placeholder="До"
            className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
          />
        </div>
      )}

      {currentType === "FROM" && (
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={stop.priceMin ?? ""}
          onChange={(e) => onChange({ priceMin: parsePriceInput(e.target.value) })}
          placeholder="От"
          className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
        />
      )}

      {currentType === "CUSTOM" && (
        <input
          type="text"
          value={stop.priceNote}
          onChange={(e) => onChange({ priceNote: e.target.value })}
          placeholder="Например: за семью, зависит от меню, по запросу"
          maxLength={120}
          className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
        />
      )}

      {currentType !== "CUSTOM" && currentType !== "FREE" && currentType !== "UNKNOWN" && (
        <div className="text-[11px] text-neutral-400 px-1">
          Валюта: {stop.priceCurrency === "BYN" ? renderCurrencyText(BYN_SYMBOL, { iconSize: "sm" }) : stop.priceCurrency}
        </div>
      )}

      {currentType !== "CUSTOM" && (
        <input
          type="text"
          value={stop.priceNote}
          onChange={(e) => onChange({ priceNote: e.target.value })}
          placeholder="Комментарий к цене"
          maxLength={120}
          className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
        />
      )}
    </div>
  );
}

function StopEditor({
  stop,
  index,
  total,
  onChange,
  onRemove,
}: {
  stop: EditableRouteStop;
  index: number;
  total: number;
  onChange: (patch: Partial<EditableRouteStop>) => void;
  onRemove: () => void;
}) {
  const hasLocation = !!stop.location;
  const isPlace = stop.location?.source === "PLACE";
  const needsCustomTitle = hasLocation && !isPlace;

  const headerTitle = isPlace
    ? stop.location!.title
    : stop.location?.customTitle ||
      stop.location?.title ||
      `Точка ${index + 1}`;

  const noteError = hasLocation && stop.note.trim().length === 0;
  const titleError = needsCustomTitle && !stop.customTitle?.trim();

  const handleLocationChange = (loc: typeof stop.location) => {
    const locationChanged =
      loc?.placeId !== stop.location?.placeId ||
      loc?.googlePlaceId !== stop.location?.googlePlaceId ||
      loc?.lat !== stop.location?.lat ||
      loc?.lng !== stop.location?.lng;

    onChange({
      location: loc,
      ...(locationChanged && loc?.source !== "PLACE"
        ? { customTitle: "" }
        : {}),
    });
  };

  return (
    <div className="relative">
      {index < total - 1 && (
        <div className="absolute left-[18px] top-full w-px h-3 bg-neutral-200 z-10" />
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
          <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {index + 1}
          </div>
          <span className="text-sm font-semibold text-neutral-700 flex-1 truncate">
            {headerTitle}
          </span>
          {total > 2 && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          <RouteStopLocationInput
            value={stop.location}
            onChange={handleLocationChange}
          />

          {hasLocation && (
            <>
              {needsCustomTitle && (
                <div>
                  <input
                    type="text"
                    value={stop.customTitle ?? ""}
                    onChange={(e) => onChange({ customTitle: e.target.value })}
                    placeholder="Например: Старт прогулки, Кафе у парка, Смотровая точка"
                    maxLength={80}
                    className={cn(
                      "w-full h-10 px-3 rounded-xl border bg-neutral-50 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 transition-all",
                      titleError
                        ? "border-red-300 focus:border-red-400"
                        : "border-neutral-200 focus:border-neutral-400",
                    )}
                  />
                  {titleError ? (
                    <p className="text-xs text-[#ef8855] mt-1.5 px-1">
                      Добавьте название точки — без него маршрут нельзя опубликовать
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400 mt-1.5 px-1">
                      Название шага маршрута — как его увидят пользователи
                    </p>
                  )}
                </div>
              )}

              <div>
                <textarea
                  value={stop.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  placeholder="Например: лучше приезжать утром или закладывайте около часа"
                  rows={6}
                  maxLength={200}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl border bg-neutral-50 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 transition-all resize-none",
                    noteError
                      ? "border-red-300 focus:border-red-400"
                      : "border-neutral-200 focus:border-neutral-400",
                  )}
                />
                {noteError && (
                  <p className="text-xs text-[#ef8855] mt-1 px-1">
                    Добавьте комментарий к точке
                  </p>
                )}
              </div>

              <StopPriceEditor stop={stop} onChange={onChange} />

              <ImageGalleryUploader
                images={stop.photos || []}
                onAdd={(img) =>
                  onChange({ photos: [...(stop.photos || []), img] })
                }
                onAddBatch={(imgs) =>
                  onChange({ photos: [...(stop.photos || []), ...imgs] })
                }
                onRemove={(id) =>
                  onChange({ photos: stop.photos?.filter((p) => p.id !== id) })
                }
                maxImages={10}
                maxSizeMB={2}
                maxWidthOrHeight={1600}
                quality={0.82}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Stops ────────────────────────────────────────────────────────────

function Step2({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: (canPublish: boolean) => void;
  onBack: () => void;
}) {
  const canContinue =
    state.stops.length >= 2 &&
    state.stops.every((s) => s.location && s.note.trim());

  const canPublish =
    canContinue &&
    state.stops.every(
      (s) => s.location?.source === "PLACE" || s.customTitle?.trim(),
    );

  const addStop = () => onChange({ stops: [...state.stops, makeEmptyStop()] });

  const updateStop = (id: string, patch: Partial<EditableRouteStop>) =>
    onChange({
      stops: state.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const removeStop = (id: string) =>
    onChange({ stops: state.stops.filter((s) => s.id !== id) });

  const derivedCity = deriveRouteCityFromStops(
    state.stops
      .filter((s) => s.location)
      .map((s) => ({
        source: s.location!.source,
        address: s.location!.address,
        cityName: s.location!.cityName,
      })),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Точки маршрута</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Минимум 2 точки · комментарий обязателен
          {derivedCity && (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
              <MapPin className="w-3 h-3" />
              {derivedCity}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {state.stops.map((stop, i) => (
          <StopEditor
            key={stop.id}
            stop={stop}
            index={i}
            total={state.stops.length}
            onChange={(patch) => updateStop(stop.id, patch)}
            onRemove={() => removeStop(stop.id)}
          />
        ))}
      </div>

      <button
        onClick={addStop}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-neutral-200 text-sm font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Добавить точку
      </button>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 rounded-2xl border-neutral-200"
          onClick={onBack}
        >
          Назад
        </Button>
        <Button
          size="lg"
          className="flex-1 rounded-2xl font-semibold"
          disabled={!canContinue}
          onClick={() => onNext(canPublish)}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Publish ──────────────────────────────────────────────────────────

function Step3({
  state,
  onChange,
  onPublish,
  onBack,
  saving,
  canPublish,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onPublish: () => void;
  onBack: () => void;
  saving: boolean;
  canPublish: boolean;
}) {
  const coverPhoto = state.stops.find((s) => s.photos && s.photos.length > 0)
    ?.photos?.[0];
  const budgetSummary = summarizeRouteBudget(state.stops, state.budgetLevel);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">
          Готово к публикации
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Проверьте и выберите видимость
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {coverPhoto && (
          <div className="aspect-[16/7] overflow-hidden">
            <img
              src={coverPhoto.url}
              alt={state.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <p className="text-base font-bold text-neutral-900">
            {state.title || "Без названия"}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {state.stops.length} {state.stops.length === 1 ? "точка" : "точки"}{" "}
            · {budgetSummary.label}
          </p>
          {budgetSummary.note && (
            <p className="text-xs text-neutral-400 mt-1">{budgetSummary.note}</p>
          )}
          {state.ageTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {state.ageTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-neutral-100 text-xs text-neutral-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-2">
          Видимость
        </label>
        <div className="space-y-2">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ visibility: opt.value })}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all",
                state.visibility === opt.value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  state.visibility === opt.value
                    ? "bg-white/20"
                    : "bg-neutral-100",
                )}
              >
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{opt.label}</p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    state.visibility === opt.value
                      ? "text-white/70"
                      : "text-neutral-400",
                  )}
                >
                  {opt.sub}
                </p>
              </div>
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                  state.visibility === opt.value
                    ? "border-white"
                    : "border-neutral-300",
                )}
              >
                {state.visibility === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          className="rounded-2xl border-neutral-200"
          onClick={onBack}
        >
          Назад
        </Button>
        <Button
          size="lg"
          className="flex-1 rounded-2xl font-semibold"
          onClick={onPublish}
          disabled={saving || !canPublish}
        >
          Опубликовать
        </Button>
      </div>
      {!canPublish && (
        <p className="text-xs text-[#ef8855] text-center -mt-2">
          У некоторых точек не заполнено название — вернитесь назад и добавьте
          его (поле подсвечено).
        </p>
      )}
    </div>
  );
}

// ─── RouteEditor ──────────────────────────────────────────────────────────────

export function RouteEditor({
  mode,
  routeId,
  initialState,
}: RouteEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(() => ({
    ...BASE_STATE,
    ...initialState,
    stops: (
      initialState?.stops && initialState.stops.length >= 2
        ? initialState.stops
        : initialState?.stops?.length === 1
          ? [...initialState.stops, makeEmptyStop()]
          : BASE_STATE.stops
    ).map(normalizeEditableStop),
  }));
  const [saving, setSaving] = useState(false);
  const [stopsCanPublish, setStopsCanPublish] = useState(false);

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));

  const isEdit = mode === "edit";

  // ── Черновик в localStorage + индикатор сохранения ─────────────────────────
  const stateJson = useMemo(() => JSON.stringify(state), [state]);
  /** Снимок состояния, совпадающего с сервером (или начального) — база для dirty */
  const baselineJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (baselineJsonRef.current === null) {
      baselineJsonRef.current = stateJson;
    }
  }, [stateJson]);
  const dirty =
    baselineJsonRef.current !== null && baselineJsonRef.current !== stateJson;

  const draft = useWizardDraft<WizardState>({
    wizardType: "route",
    mode,
    entityId: isEdit ? routeId : null,
    schemaVersion: ROUTE_WIZARD_DRAFT_SCHEMA_VERSION,
    data: state,
    enabled: dirty && isMeaningfulRouteDraft(state),
  });

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange, requestLeave } =
    useUnsavedChangesNavigationGuard(dirty);

  const handleRestoreDraft = () => {
    const restored = draft.restoreDraft();
    if (!restored) return;
    setState({
      ...BASE_STATE,
      ...restored,
      stops:
        restored.stops.length > 0
          ? restored.stops.map(normalizeEditableStop)
          : BASE_STATE.stops,
    });
  };

  const handleSave = async (publish: boolean) => {
    if (saving) return;
    setSaving(true);

    try {
      if (!state.title.trim()) {
        toast.error("Укажите название маршрута");
        return;
      }

      const validStops = state.stops.filter((s) => s.location !== null);

      if (publish && validStops.length < 2) {
        toast.error("Для публикации нужно минимум 2 остановки", {
          description: "Добавьте ещё остановки или сохраните как черновик",
        });
        return;
      }

      const body = {
        title: state.title,
        ageTags: state.ageTags,
        budgetLevel: state.budgetLevel,
        visibility: state.visibility,
        publish,
        stops: validStops.map((s, i) => ({
          order: i + 1,
          address: s.location!.address,
          note: s.note,
          photoUrl: s.photos?.[0]?.url,
          lat: s.location?.lat,
          lng: s.location?.lng,
          placeId:
            s.location?.source === "PLACE" ? s.location.placeId : undefined,
          customTitle:
            s.location?.source !== "PLACE"
              ? (s.customTitle ?? undefined)
              : undefined,
          priceType: s.priceType,
          priceMin: s.priceMin ?? null,
          priceMax: s.priceMax ?? null,
          priceCurrency: s.priceCurrency || "BYN",
          priceNote: s.priceNote.trim() || null,
        })),
      };

      const endpoint = isEdit ? `/api/routes/${routeId}` : "/api/routes";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMessage =
          err.error === "at least 2 stops required to publish" ||
          err.error === "at least 2 stops required"
            ? "Для публикации нужно минимум 2 остановки"
            : err.error || "Ошибка сохранения";
        throw new Error(errorMessage);
      }

      const { slug } = await res.json();

      // Сохранено на сервере: локальный черновик больше не нужен, guard снят
      draft.markClean();
      baselineJsonRef.current = JSON.stringify(state);

      if (isEdit) {
        toast.success(publish ? "Маршрут обновлён" : "Изменения сохранены");
        router.push(`/routes/${slug}`);
      } else {
        toast.success(publish ? "Маршрут опубликован" : "Черновик сохранён", {
          description: publish
            ? "Он появится в каталоге"
            : "Вы можете вернуться к нему позже",
        });
        router.push(publish ? `/routes/${slug}` : "/routes");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const draftButtonLabel = isEdit ? "Сохранить" : "Сохранить черновик";
  const headingLabel = isEdit ? "Редактировать маршрут" : "Создать маршрут";

  return (
    <div className="min-h-screen bg-[#F8F8F7]">
      <Container className="max-w-lg py-6 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() =>
              step > 1 ? setStep((s) => s - 1) : requestLeave(() => router.back())
            }
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-neutral-900">
              {headingLabel}
            </h1>
            <p className="text-xs text-neutral-400">Шаг {step} из 3</p>
          </div>
          <SaveIndicator
            status={draft.status}
            lastSavedAt={draft.lastSavedAt}
            onRetry={draft.retry}
            className="hidden sm:inline-flex"
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-neutral-200"
            disabled={
              !state.title.trim() || state.title.trim().length < 3 || saving
            }
            onClick={() => handleSave(false)}
          >
            {draftButtonLabel}
          </Button>
        </div>

        {draft.hasDraft && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-700">
              У вас есть незавершённый черновик
              {draft.draftSavedAt
                ? ` (${formatRelativeTimeRu(draft.draftSavedAt)})`
                : ""}
              . Продолжить с него?
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-neutral-200"
                onClick={() => draft.discardDraft()}
              >
                Начать заново
              </Button>
              <Button size="sm" className="rounded-xl" onClick={handleRestoreDraft}>
                Продолжить
              </Button>
            </div>
          </div>
        )}

        <StepIndicator step={step} />

        {step === 1 && (
          <Step1 state={state} onChange={patch} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2
            state={state}
            onChange={patch}
            onNext={(cp) => {
              setStopsCanPublish(cp);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            state={state}
            onChange={patch}
            onPublish={() => handleSave(true)}
            onBack={() => setStep(2)}
            saving={saving}
            canPublish={stopsCanPublish}
          />
        )}
      </Container>

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Уйти со страницы?</AlertDialogTitle>
            <AlertDialogDescription>
              Изменения не сохранены на сервере. Черновик остаётся на этом
              устройстве — вы сможете продолжить позже.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>Уйти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
