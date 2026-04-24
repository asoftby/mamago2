"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/button";
import { AGE_OPTIONS } from "@/lib/config/ages";
import { ImageUploader, ImagePreview } from "@/components/image/ImageUploader";
import type { UploadedImage } from "@/hooks/useImageUpload";
import {
  RouteStopLocationInput,
  type RouteStopLocationValue,
} from "@/components/routes/RouteStopLocationInput";
import { deriveRouteCityFromStops } from "@/lib/routes/cityDerivation";
import {
  ArrowLeft, Plus, Trash2, MapPin,
  Globe, Lock, Link2,
} from "lucide-react";
import { toast } from "@/lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetLevel = "FREE" | "LOW" | "MEDIUM" | "HIGH";
type Visibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export type EditableRouteStop = {
  id: string;
  location: RouteStopLocationValue | null;
  /** User-set step label — required for publish when source is GOOGLE or MANUAL_PIN */
  customTitle?: string;
  note: string;
  photo?: UploadedImage;
};

type WizardState = {
  title: string;
  ageTags: string[];
  budgetLevel: BudgetLevel;
  stops: EditableRouteStop[];
  visibility: Visibility;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BUDGET_OPTIONS: { value: BudgetLevel; label: string; sub: string }[] = [
  { value: "FREE", label: "Бесплатно", sub: "Без затрат" },
  { value: "LOW", label: "до 50 BYN", sub: "Бюджетно" },
  { value: "MEDIUM", label: "50–150 BYN", sub: "Средний бюджет" },
  { value: "HIGH", label: "150+ BYN", sub: "Премиум" },
];

const VISIBILITY_OPTIONS: { value: Visibility; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: "PUBLIC", label: "Публичный", sub: "Виден всем в каталоге", icon: <Globe className="w-4 h-4" /> },
  { value: "UNLISTED", label: "По ссылке", sub: "Только по прямой ссылке", icon: <Link2 className="w-4 h-4" /> },
  { value: "PRIVATE", label: "Приватный", sub: "Только для вас", icon: <Lock className="w-4 h-4" /> },
];

const AGE_GROUPS = AGE_OPTIONS.filter((a) =>
  ["0-1", "1-3", "3-5", "5-7", "7-9", "9-12", "12-14"].includes(a.key)
);

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
                : "bg-neutral-100 text-neutral-400"
            )}
          >
            {s}
          </div>
          {s < 3 && (
            <div className={cn("flex-1 h-px", s < step ? "bg-neutral-300" : "bg-neutral-100")} />
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Основа маршрута</h2>
        <p className="text-sm text-neutral-500 mt-1">Расскажите, что это за день</p>
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
          {AGE_GROUPS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleAge(opt.key)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-all border",
                state.ageTags.includes(opt.key)
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
              )}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-2">
          Бюджет маршрута
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ budgetLevel: opt.value })}
              className={cn(
                "flex flex-col items-start px-4 py-3 rounded-2xl border text-left transition-all",
                state.budgetLevel === opt.value
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
              )}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className={cn("text-xs mt-0.5", state.budgetLevel === opt.value ? "text-white/70" : "text-neutral-400")}>
                {opt.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full rounded-2xl font-semibold"
        disabled={!canContinue}
        onClick={onNext}
      >
        Продолжить
      </Button>
    </div>
  );
}

// ─── Stop Editor ──────────────────────────────────────────────────────────────

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

  // Display title in header: Place title or customTitle or fallback
  const headerTitle = isPlace
    ? stop.location!.title
    : stop.location?.customTitle || stop.location?.title || `Точка ${index + 1}`;

  const noteError = hasLocation && stop.note.trim().length === 0;

  const handleLocationChange = (loc: typeof stop.location) => {
    // Clear customTitle only when the user picks a genuinely new location
    // (identified by a different placeId / googlePlaceId / lat+lng combo)
    const locationChanged =
      loc?.placeId !== stop.location?.placeId ||
      loc?.googlePlaceId !== stop.location?.googlePlaceId ||
      loc?.lat !== stop.location?.lat ||
      loc?.lng !== stop.location?.lng;

    onChange({
      location: loc,
      ...(locationChanged && loc?.source !== "PLACE" ? { customTitle: "" } : {}),
    });
  };

  return (
    <div className="relative">
      {/* Vertical connector between stops */}
      {index < total - 1 && (
        <div className="absolute left-[18px] top-full w-px h-3 bg-neutral-200 z-10" />
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {/* Header */}
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
          {/* Location input */}
          <RouteStopLocationInput
            value={stop.location}
            onChange={handleLocationChange}
          />

          {/* Fields shown after location is selected */}
          {hasLocation && (
            <>
              {/* Custom title — only for GOOGLE / MANUAL_PIN */}
              {needsCustomTitle && (
                <div>
                  <input
                    type="text"
                    value={stop.customTitle ?? ""}
                    onChange={(e) => onChange({ customTitle: e.target.value })}
                    placeholder="Например: Старт прогулки, Кафе у парка, Смотровая точка"
                    maxLength={80}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
                  />
                  <p className="text-xs text-neutral-400 mt-1.5 px-1">
                    Название шага маршрута — как его увидят пользователи
                  </p>
                </div>
              )}

              {/* Note */}
              <div>
                <textarea
                  value={stop.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  placeholder="Например: лучше приезжать утром или закладывайте около часа"
                  rows={2}
                  maxLength={200}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl border bg-neutral-50 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 transition-all resize-none",
                    noteError ? "border-red-300 focus:border-red-400" : "border-neutral-200 focus:border-neutral-400"
                  )}
                />
                {noteError && (
                  <p className="text-xs text-red-500 mt-1 px-1">Добавьте комментарий к точке</p>
                )}
              </div>

              {/* Photo */}
              {stop.photo ? (
                <div className="relative rounded-xl overflow-hidden aspect-[16/9]">
                  <ImagePreview
                    image={stop.photo}
                    onRemove={() => onChange({ photo: undefined })}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <ImageUploader
                  onUpload={(img) => onChange({ photo: img })}
                  maxSizeMB={2}
                  maxWidthOrHeight={1600}
                  quality={0.82}
                  className="rounded-xl overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 hover:border-neutral-400 hover:bg-white transition-all cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-600">Добавить фото точки</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Необязательно · JPEG, PNG, WebP</p>
                    </div>
                  </div>
                </ImageUploader>
              )}
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
    state.stops.every((s) => {
      if (!s.location || !s.note.trim()) return false;
      return true;
    });

  // Stricter check used only when publishing (passed to Step3)
  const canPublish =
    canContinue &&
    state.stops.every((s) => {
      if (s.location?.source !== "PLACE" && !s.customTitle?.trim()) return false;
      return true;
    });

  const addStop = () => {
    onChange({
      stops: [...state.stops, makeEmptyStop()],
    });
  };

  const updateStop = (id: string, patch: Partial<EditableRouteStop>) => {
    onChange({
      stops: state.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeStop = (id: string) => {
    onChange({ stops: state.stops.filter((s) => s.id !== id) });
  };

  const derivedCity = deriveRouteCityFromStops(
    state.stops
      .filter((s) => s.location)
      .map((s) => ({
        source: s.location!.source,
        address: s.location!.address,
        cityName: s.location!.cityName,
      }))
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
        <Button variant="outline" size="lg" className="flex-1 rounded-2xl border-neutral-200" onClick={onBack}>
          Назад
        </Button>
        <Button size="lg" className="flex-1 rounded-2xl font-semibold" disabled={!canContinue} onClick={() => onNext(canPublish)}>
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
  onSaveDraft,
  onBack,
  saving,
  canPublish,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
  saving: boolean;
  canPublish: boolean;
}) {
  const coverPhoto = state.stops.find((s) => s.photo)?.photo;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Готово к публикации</h2>
        <p className="text-sm text-neutral-500 mt-1">Проверьте и выберите видимость</p>
      </div>

      {/* Preview card */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {coverPhoto && (
          <div className="aspect-[16/7] overflow-hidden">
            <img src={coverPhoto.url} alt={state.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4">
          <p className="text-base font-bold text-neutral-900">{state.title || "Без названия"}</p>
          <p className="text-sm text-neutral-500 mt-1">
            {state.stops.length} {state.stops.length === 1 ? "точка" : "точки"} ·{" "}
            {BUDGET_OPTIONS.find((b) => b.value === state.budgetLevel)?.label}
          </p>
          {state.ageTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {state.ageTags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-neutral-100 text-xs text-neutral-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visibility */}
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
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                state.visibility === opt.value ? "bg-white/20" : "bg-neutral-100"
              )}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className={cn("text-xs mt-0.5", state.visibility === opt.value ? "text-white/70" : "text-neutral-400")}>
                  {opt.sub}
                </p>
              </div>
              <div className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                state.visibility === opt.value ? "border-white" : "border-neutral-300"
              )}>
                {state.visibility === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" size="lg" className="rounded-2xl border-neutral-200" onClick={onBack}>
          Назад
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 rounded-2xl border-neutral-200"
          onClick={onSaveDraft}
          disabled={saving}
        >
          Черновик
        </Button>
        <Button
          size="lg"
          className="flex-1 rounded-2xl font-semibold"
          onClick={onPublish}
          disabled={saving || !canPublish}
          title={!canPublish ? "Добавьте названия для всех точек без места из каталога" : undefined}
        >
          Опубликовать
        </Button>
      </div>
    </div>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

function makeEmptyStop(): EditableRouteStop {
  return { id: crypto.randomUUID(), location: null, note: "" };
}

const INITIAL_STATE: WizardState = {
  title: "",
  ageTags: [],
  budgetLevel: "LOW",
  stops: [makeEmptyStop(), makeEmptyStop()],
  visibility: "PUBLIC",
};

export function CreateRouteWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [stopsCanPublish, setStopsCanPublish] = useState(false);

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));

  const handleSave = async (publish: boolean) => {
    setSaving(true);
    try {
      const body = {
        title: state.title,
        ageTags: state.ageTags,
        budgetLevel: state.budgetLevel,
        visibility: state.visibility,
        publish,
        stops: state.stops.map((s, i) => ({
          order: i + 1,
          address: s.location?.address ?? s.location?.title ?? "",
          note: s.note,
          photoUrl: s.photo?.url,
          lat: s.location?.lat,
          lng: s.location?.lng,
          placeId: s.location?.source === "PLACE" ? s.location.placeId : undefined,
          customTitle:
            s.location?.source !== "PLACE" ? (s.customTitle ?? undefined) : undefined,
        })),
      };

      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Ошибка сохранения");
      }

      const { slug } = await res.json();

      toast.success(publish ? "Маршрут опубликован" : "Черновик сохранён", {
        description: publish ? "Он появится в каталоге" : "Вы можете вернуться к нему позже",
      });

      router.push(publish ? `/routes/${slug}` : "/routes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F7]">
      <Container className="max-w-lg py-6 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">Создать маршрут</h1>
            <p className="text-xs text-neutral-400">Шаг {step} из 3</p>
          </div>
        </div>

        <StepIndicator step={step} />

        {step === 1 && (
          <Step1 state={state} onChange={patch} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2
            state={state}
            onChange={patch}
            onNext={(cp) => { setStopsCanPublish(cp); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            state={state}
            onChange={patch}
            onPublish={() => handleSave(true)}
            onSaveDraft={() => handleSave(false)}
            onBack={() => setStep(2)}
            saving={saving}
            canPublish={stopsCanPublish}
          />
        )}
      </Container>
    </div>
  );
}
