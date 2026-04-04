"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FilterSelect,
  type FilterSelectOption,
} from "@/components/ui/filter-select";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { BodyMuted } from "@/components/ui/typography";
import { ArrowLeft, Baby, UserRound } from "lucide-react";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { cn } from "@/lib/utils";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

export interface ParticipantChildData {
  id: string;
  name: string;
  birthDate: Date | null;
  systemInterests?: { interestSlug: string }[];
  customInterests?: { label: string }[];
}

export type AddParticipantModalProps = {
  isOpen: boolean;
  onClose: () => void;
  childData?: ParticipantChildData;
  /** Сразу форма взрослого (текущий пользователь) */
  editAdult?: boolean;
  onSaved?: (payload: { kind: "child" | "adult"; childId?: string }) => void;
};

const STEP_ANIMATION =
  "animate-in fade-in slide-in-from-right-2 duration-200 fill-mode-both";

const FAMILY_ROLES = [
  { value: "MOM" as const, label: "Мама" },
  { value: "DAD" as const, label: "Папа" },
  { value: "GRANDMA" as const, label: "Бабушка" },
  { value: "GRANDPA" as const, label: "Дедушка" },
  { value: "ADULT" as const, label: "Взрослый" },
];

const AGE_BANDS = ["18–24", "25–34", "35–44", "45–54", "55+"];

const MAX_PREFERENCE_SIGNALS = 3;

const MONTHS_RU = [
  { m: 0, label: "Январь" },
  { m: 1, label: "Февраль" },
  { m: 2, label: "Март" },
  { m: 3, label: "Апрель" },
  { m: 4, label: "Май" },
  { m: 5, label: "Июнь" },
  { m: 6, label: "Июль" },
  { m: 7, label: "Август" },
  { m: 8, label: "Сентябрь" },
  { m: 9, label: "Октябрь" },
  { m: 10, label: "Ноябрь" },
  { m: 11, label: "Декабрь" },
];

const BIRTH_MONTH_FILTER_OPTIONS: FilterSelectOption[] = MONTHS_RU.map(
  ({ m, label }) => ({ value: String(m), label }),
);

function birthYearOptions(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 26 }, (_, i) => y - i);
}

function birthYearFilterOptions(): FilterSelectOption[] {
  return birthYearOptions().map((year) => ({
    value: String(year),
    label: String(year),
  }));
}

function toBirthIso(month: number | "", year: number | ""): string | null {
  if (month === "" || year === "") return null;
  const d = new Date(year, month, 1, 12, 0, 0, 0);
  return d.toISOString();
}

type AdultPersonaSignalChip = {
  id: string;
  slug: string;
  title: string;
  order: number;
};

/** Чипы через ChipsRow masonry (как в ui-lab), без отдельной карточки-обёртки. */
function ParticipantChipField({
  label,
  hint,
  ariaLabel,
  items,
  emptyState,
}: {
  label: string;
  hint?: ReactNode;
  ariaLabel: string;
  items: ChipItem[];
  emptyState?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint ? (
        <BodyMuted className="text-xs md:text-xs">{hint}</BodyMuted>
      ) : null}
      {emptyState ? (
        emptyState
      ) : (
        <ChipsRow layout="masonry" aria-label={ariaLabel} items={items} />
      )}
    </div>
  );
}

function HighZIndexDialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 bg-black/50 animate-in fade-in-0 duration-200"
          style={{ zIndex: 9998 }}
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      ) : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </>
  );
}

export function AddParticipantModal({
  isOpen,
  onClose,
  childData,
  editAdult,
  onSaved,
}: AddParticipantModalProps) {
  /**
   * Один контейнер (Dialog), без переключения Sheet/Dialog по ширине — иначе React
   * размонтирует ParticipantFlow, сбрасывает participantType (остаётся «child»), а на
   * экране шаг 2 взрослого → сохранение уходит в ветку ребёнка и молча не отправляется PATCH.
   */
  return (
    <HighZIndexDialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full",
          "max-sm:fixed max-sm:bottom-4 max-sm:left-1/2 max-sm:top-auto max-sm:translate-x-[-50%] max-sm:translate-y-0",
        )}
        style={{ zIndex: 9999 }}
      >
        <DialogTitle className="sr-only">Добавить участника</DialogTitle>
        <ParticipantFlow
          isOpen={isOpen}
          onClose={onClose}
          childData={childData}
          editAdult={editAdult}
          onSaved={onSaved}
        />
      </DialogContent>
    </HighZIndexDialog>
  );
}

function ParticipantFlow({
  isOpen,
  onClose,
  childData,
  editAdult,
  onSaved,
}: AddParticipantModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [participantType, setParticipantType] = useState<"child" | "adult">("child");

  const [childName, setChildName] = useState("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [childInterests, setChildInterests] = useState<string[]>([]);

  const [adultName, setAdultName] = useState("");
  const [familyRole, setFamilyRole] = useState<(typeof FAMILY_ROLES)[number]["value"] | "">("");
  const [ageBand, setAgeBand] = useState<string | "">("");
  const [preferenceSignals, setPreferenceSignals] = useState<AdultPersonaSignalChip[]>([]);
  const [formatSignals, setFormatSignals] = useState<AdultPersonaSignalChip[]>([]);
  const [selectedPreferenceIds, setSelectedPreferenceIds] = useState<string[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditChild = !!childData;
  const isEditAdultMode = !!editAdult && !childData;

  const resetAll = useCallback(() => {
    setStep(1);
    setParticipantType("child");
    setChildName("");
    setBirthMonth("");
    setBirthYear("");
    setChildInterests([]);
    setAdultName("");
    setFamilyRole("");
    setAgeBand("");
    setSelectedPreferenceIds([]);
    setSelectedFormatId(null);
    setError(null);
    setIsLoading(false);
    setIsDeleting(false);
  }, []);

  const loadMeForAdult = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const me = await res.json();
      const trimmed =
        typeof me.displayName === "string" ? me.displayName.trim() : "";
      const fromEmail =
        typeof me.email === "string" ? me.email.split("@")[0] : "";
      setAdultName(trimmed || fromEmail || "");
      setFamilyRole(me.familyRole ?? "");
      setAgeBand(me.ageBandLabel ?? "");
      const pids = me.preferenceSignalIds;
      setSelectedPreferenceIds(Array.isArray(pids) ? pids : []);
      setSelectedFormatId(
        typeof me.leisureFormatSignalId === "string" ? me.leisureFormatSignalId : null,
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/signals/adult-persona", { cache: "no-store" });
        const data = (await res.json()) as {
          preferenceSignals?: AdultPersonaSignalChip[];
          formatSignals?: AdultPersonaSignalChip[];
        };
        if (cancelled) return;
        setPreferenceSignals(data.preferenceSignals ?? []);
        setFormatSignals(data.formatSignals ?? []);
      } catch {
        if (!cancelled) {
          setPreferenceSignals([]);
          setFormatSignals([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      resetAll();
      return;
    }

    if (childData) {
      setStep(2);
      setParticipantType("child");
      setChildName(childData.name);
      const bd = childData.birthDate ? new Date(childData.birthDate) : null;
      if (bd && !Number.isNaN(bd.getTime())) {
        setBirthMonth(bd.getMonth());
        setBirthYear(bd.getFullYear());
      } else {
        setBirthMonth("");
        setBirthYear("");
      }
      setChildInterests(childData.systemInterests?.map((i) => i.interestSlug) ?? []);
      return;
    }

    if (editAdult) {
      setStep(2);
      setParticipantType("adult");
      void loadMeForAdult();
      return;
    }

    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только id ребёнка, иначе лишние сбросы при ререндере родителя
  }, [isOpen, childData?.id, editAdult, resetAll, loadMeForAdult]);

  const toggleChildInterest = useCallback((slug: string) => {
    setChildInterests((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const togglePreferenceSignal = (id: string) => {
    setSelectedPreferenceIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PREFERENCE_SIGNALS) return prev;
      return [...prev, id];
    });
  };

  const toggleFormatSignal = (id: string) => {
    setSelectedFormatId((cur) => (cur === id ? null : id));
  };

  const familyRoleChipItems = useMemo<ChipItem[]>(
    () =>
      FAMILY_ROLES.map((r) => ({
        id: r.value,
        label: r.label,
        active: familyRole === r.value,
        onClick: () => setFamilyRole((cur) => (cur === r.value ? "" : r.value)),
      })),
    [familyRole],
  );

  const ageBandChipItems = useMemo<ChipItem[]>(
    () =>
      AGE_BANDS.map((band) => ({
        id: band,
        label: band,
        active: ageBand === band,
        onClick: () => setAgeBand((cur) => (cur === band ? "" : band)),
      })),
    [ageBand],
  );

  const childInterestChipItems = useMemo<ChipItem[]>(
    () =>
      SYSTEM_INTERESTS.map((interest) => ({
        id: interest.slug,
        label: interest.label,
        active: childInterests.includes(interest.slug),
        onClick: () => toggleChildInterest(interest.slug),
      })),
    [childInterests, toggleChildInterest],
  );

  const preferenceSignalChipItems = useMemo<ChipItem[]>(
    () =>
      preferenceSignals.map((s) => {
        const active = selectedPreferenceIds.includes(s.id);
        const atLimit = selectedPreferenceIds.length >= MAX_PREFERENCE_SIGNALS;
        return {
          id: s.id,
          label: s.title,
          active,
          disabled: atLimit && !active,
          onClick: () => togglePreferenceSignal(s.id),
        };
      }),
    [preferenceSignals, selectedPreferenceIds],
  );

  const formatSignalChipItems = useMemo<ChipItem[]>(
    () =>
      formatSignals.map((s) => ({
        id: s.id,
        label: s.title,
        active: selectedFormatId === s.id,
        onClick: () => toggleFormatSignal(s.id),
      })),
    [formatSignals, selectedFormatId],
  );

  const goPickChild = () => {
    setParticipantType("child");
    setStep(2);
  };

  const goPickAdult = () => {
    setParticipantType("adult");
    setStep(2);
    void loadMeForAdult();
  };

  const goBackToStep1 = () => {
    if (isEditChild || isEditAdultMode) {
      onClose();
      return;
    }
    setStep(1);
  };

  const canSaveChild = childName.trim().length >= 1;
  const canSaveAdult = adultName.trim().length >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) return;

    const saveAdult = async () => {
      if (!canSaveAdult) {
        setError("Укажите имя");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: adultName.trim(),
            familyRole: familyRole || null,
            ageBandLabel: ageBand || null,
            preferenceSignalIds: selectedPreferenceIds,
            leisureFormatSignalId: selectedFormatId,
            preferenceSummary: null,
            leisureFormatSummary: null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail =
            data?.details && typeof data.details === "object"
              ? ` ${JSON.stringify(data.details)}`
              : "";
          throw new Error((data?.error || "Не удалось сохранить") + detail);
        }
        onClose();
        onSaved?.({ kind: "adult" });
        notifyFamilyPersonasChanged();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setIsLoading(false);
      }
    };

    const saveChild = async () => {
      if (!canSaveChild) {
        setError("Укажите имя ребёнка");
        return;
      }
      setIsLoading(true);
      setError(null);
      const birthIso = toBirthIso(birthMonth, birthYear);
      const body = {
        name: childName.trim(),
        birthDate: birthIso,
        systemInterests: childInterests,
        customInterests: [] as string[],
      };
      try {
        const url = isEditChild ? `/api/children/${childData!.id}` : "/api/children";
        const res = await fetch(url, {
          method: isEditChild ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Не удалось сохранить");
        }
        const childId = isEditChild ? childData!.id : data?.child?.id;
        onClose();
        onSaved?.({ kind: "child", childId });
        notifyFamilyPersonasChanged();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setIsLoading(false);
      }
    };

    if (step === 2 && childData) {
      await saveChild();
      return;
    }

    if (step === 2 && !childData && (editAdult || participantType === "adult")) {
      await saveAdult();
      return;
    }

    if (step === 2 && participantType === "child") {
      await saveChild();
      return;
    }
  };

  const handleDeleteChild = async () => {
    if (!childData) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/children/${childData.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Не удалось удалить");
      }
      onClose();
      notifyFamilyPersonasChanged();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsDeleting(false);
    }
  };

  const showStep1 = step === 1 && !isEditChild && !isEditAdultMode;
  const showChildForm = step === 2 && participantType === "child";
  const showAdultForm = step === 2 && participantType === "adult";

  const headerSubtitle = participantType === "child" ? "Ребёнок" : "Взрослый";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {showStep1 ? (
        <div key="step1" className={cn("flex flex-col px-5 pt-5 pb-2", STEP_ANIMATION)}>
          <h2 className="text-lg font-semibold text-neutral-900 pr-10 mb-5">Кого добавить?</h2>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={goPickChild}
              className={cn(
                "rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm",
                "transition-colors duration-200 hover:border-primary/40 hover:bg-primary/[0.03]",
                "active:scale-[0.99]",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Baby className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-neutral-900">Ребёнок</p>
                  <p className="text-sm text-neutral-500 mt-0.5">Укажем возраст и интересы</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={goPickAdult}
              className={cn(
                "rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm",
                "transition-colors duration-200 hover:border-primary/40 hover:bg-primary/[0.03]",
                "active:scale-[0.99]",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-neutral-900">Взрослый</p>
                  <p className="text-sm text-neutral-500 mt-0.5">Настроим предпочтения</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {!showStep1 ? (
        <form
          key="step2"
          id="participant-flow-form"
          onSubmit={handleSubmit}
          className={cn("flex min-h-0 flex-1 flex-col", STEP_ANIMATION)}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <button
              type="button"
              onClick={goBackToStep1}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-neutral-900 truncate">
                Добавить участника
              </h2>
              <p className="text-xs text-neutral-500 truncate">{headerSubtitle}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {showChildForm ? (
              <div className="space-y-5 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="child-name">Имя</Label>
                  <Input
                    id="child-name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Как зовут"
                    className="h-11"
                    autoComplete="given-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="birth-month">Месяц рождения</Label>
                    <FilterSelect
                      id="birth-month"
                      value={birthMonth === "" ? "" : String(birthMonth)}
                      placeholder="Не указано"
                      options={BIRTH_MONTH_FILTER_OPTIONS}
                      onChange={(v) =>
                        setBirthMonth(v === "" ? "" : Number(v))
                      }
                      selectClassName="h-11"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="birth-year">Год рождения</Label>
                    <FilterSelect
                      id="birth-year"
                      value={birthYear === "" ? "" : String(birthYear)}
                      placeholder="Не указано"
                      options={birthYearFilterOptions()}
                      onChange={(v) =>
                        setBirthYear(v === "" ? "" : Number(v))
                      }
                      selectClassName="h-11"
                    />
                  </div>
                </div>
                <ParticipantChipField
                  label="Интересы"
                  hint="Рекомендуем заполнить, для более точных рекомендаций"
                  ariaLabel="Интересы ребёнка"
                  items={childInterestChipItems}
                />
              </div>
            ) : null}

            {showAdultForm ? (
              <div className="space-y-5 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="adult-name">Имя</Label>
                  <Input
                    id="adult-name"
                    value={adultName}
                    onChange={(e) => setAdultName(e.target.value)}
                    placeholder="Как к вам обращаться"
                    className="h-11"
                    autoComplete="name"
                  />
                </div>
                <ParticipantChipField
                  label="Роль"
                  ariaLabel="Роль в семье"
                  items={familyRoleChipItems}
                />
                <ParticipantChipField
                  label="Возрастной диапазон"
                  ariaLabel="Возрастной диапазон"
                  items={ageBandChipItems}
                />
                <ParticipantChipField
                  label="Предпочтения"
                  hint="Выберите до 3-х предпочтений"
                  ariaLabel="Предпочтения"
                  items={preferenceSignalChipItems}
                  emptyState={
                    preferenceSignals.length === 0 ? (
                      <BodyMuted className="text-sm">Загружаем варианты…</BodyMuted>
                    ) : undefined
                  }
                />
                <ParticipantChipField
                  label="Формат досуга"
                  ariaLabel="Формат досуга"
                  items={formatSignalChipItems}
                  emptyState={
                    formatSignals.length === 0 ? (
                      <BodyMuted className="text-sm">Загружаем варианты…</BodyMuted>
                    ) : undefined
                  }
                />
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-neutral-100 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                className="h-11 w-full"
                disabled={
                  isLoading ||
                  isDeleting ||
                  (participantType === "child" ? !canSaveChild : !canSaveAdult)
                }
              >
                {isLoading ? "Сохранение..." : "Сохранить"}
              </Button>
              {showChildForm && isEditChild ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-0 w-full py-2 text-xs font-normal text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={isLoading || isDeleting}
                    >
                      Удалить профиль ребёнка
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogPortal>
                    <AlertDialogOverlay className="fixed inset-0 z-[9999] bg-black/20" />
                    <AlertDialogPrimitive.Content
                      className="fixed left-[50%] top-[50%] z-[10000] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-lg"
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить профиль ребёнка?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Это действие удалит данные ребёнка из семейного профиля.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteChild}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleting ? "Удаление..." : "Удалить"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogPrimitive.Content>
                  </AlertDialogPortal>
                </AlertDialog>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}

      {showStep1 ? (
        <div className="shrink-0 border-t border-neutral-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onClose}>
            Отмена
          </Button>
        </div>
      ) : null}
    </div>
  );
}
