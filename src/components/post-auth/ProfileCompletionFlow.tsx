"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FilterSelect,
  type FilterSelectOption,
} from "@/components/ui/filter-select";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { useChildInterests } from "@/hooks/useChildInterests";
import { cn } from "@/lib/utils";
import { FAMILY_ROLE_OPTIONS } from "@/lib/family/adultPersonaOptions";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";
import type {
  AuthEntryPoint,
  ProfileCompletionStepId,
  ProfileMandatoryStepId,
  ProfileStatePayload,
} from "@/lib/post-auth/types";
import {
  trackPostAuthEvent,
  type PostAuthAnalyticsEvent,
} from "@/lib/post-auth/analytics";
import {
  trackFamilyOnboardingStarted,
  trackChildContextCompleted,
  trackOnboardingCompleted,
} from "@/lib/onboarding/firstPartyEvents";
import {
  nextStepAfterAdultSave,
  nextStepAfterChildSave,
  nextStepAfterInterests,
  resolveInitialProfileFlowAction,
} from "@/lib/post-auth/profileCompletionFlow";

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

const BIRTH_MONTH_OPTIONS: FilterSelectOption[] = MONTHS_RU.map(({ m, label }) => ({
  value: String(m),
  label,
}));

function birthYearOptions(): FilterSelectOption[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 26 }, (_, i) => {
    const year = y - i;
    return { value: String(year), label: String(year) };
  });
}

function toBirthIso(month: number, year: number): string {
  const d = new Date(year, month, 1, 12, 0, 0, 0);
  return d.toISOString();
}

function parseBirthParts(iso: string | null): { month: string; year: string } {
  if (!iso) return { month: "", year: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { month: "", year: "" };
  return { month: String(d.getMonth()), year: String(d.getFullYear()) };
}

function CompletionProgressBar({
  step,
}: {
  step: ProfileCompletionStepId;
}) {
  const labels = ["Взрослый", "Ребёнок", "Интересы", "Готово"];
  const activeIndex =
    step === "adult"
      ? 0
      : step === "child"
        ? 1
        : step === "child_interests"
          ? 2
          : 3;

  return (
    <div className="mb-6 flex gap-1.5">
      {labels.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1">
          <div
            className={cn(
              "h-1 rounded-full transition-colors",
              i <= activeIndex ? "bg-neutral-900" : "bg-neutral-200",
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium leading-tight text-center",
              i === activeIndex ? "text-neutral-900" : "text-neutral-400",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface ProfileCompletionFlowProps {
  entryPoint: AuthEntryPoint;
  returnTo: string | null;
  /**
   * После завершения flow. `alreadyComplete` — профиль уже был usable при открытии
   * (не вызывать повторно post-auth outcome у родителя).
   */
  onFinished: (options?: { alreadyComplete?: boolean }) => void;
}

export function ProfileCompletionFlow({
  entryPoint,
  returnTo,
  onFinished,
}: ProfileCompletionFlowProps) {
  const router = useRouter();
  const { interests, isLoading: interestsLoading, error: interestsError, retry: retryInterests } = useChildInterests();
  const onFinishedRef = React.useRef(onFinished);
  onFinishedRef.current = onFinished;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [snapshot, setSnapshot] = React.useState<ProfileStatePayload | null>(null);
  const [step, setStep] = React.useState<ProfileCompletionStepId>("adult");

  const [familyRole, setFamilyRole] = React.useState<string>("");

  const [childName, setChildName] = React.useState("");
  const [birthMonth, setBirthMonth] = React.useState<string>("");
  const [birthYear, setBirthYear] = React.useState<string>("");
  const [activeChildId, setActiveChildId] = React.useState<string | null>(null);
  const [addingAnotherChild, setAddingAnotherChild] = React.useState(false);

  const [selectedInterests, setSelectedInterests] = React.useState<string[]>([]);

  const stepRef = React.useRef(step);
  stepRef.current = step;

  const track = React.useCallback(
    (event: PostAuthAnalyticsEvent, props?: Record<string, unknown>) => {
      trackPostAuthEvent(event, { entryPoint, step: stepRef.current, ...props });
    },
    [entryPoint],
  );

  const refreshState = React.useCallback(async () => {
    const res = await fetch("/api/me/profile-state", { credentials: "include" });
    if (!res.ok) throw new Error("profile_state");
    const data = (await res.json()) as ProfileStatePayload;
    setSnapshot(data);
    return data;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await refreshState();
        if (cancelled) return;
        const initialAction = resolveInitialProfileFlowAction(data);
        if (initialAction.kind === "finish") {
          onFinishedRef.current({ alreadyComplete: initialAction.alreadyComplete });
          return;
        }
        track("completion_started", {});
        trackFamilyOnboardingStarted();
        const start = initialAction.step;
        setStep(start);
        track("completion_step_viewed", { completionStep: start });
        setFamilyRole(data.user.familyRole ?? "");
        const primary = data.children[0];
        if (primary) {
          setActiveChildId(primary.id);
          setChildName(primary.name || "");
          const parts = parseBirthParts(primary.birthDate);
          setBirthMonth(parts.month);
          setBirthYear(parts.year);
        } else {
          setActiveChildId(null);
        }
      } catch {
        if (!cancelled) setError("Не удалось загрузить профиль");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshState, track]);

  React.useEffect(() => {
    if (!snapshot || loading) return;
    track("completion_step_viewed", { completionStep: step });
  }, [step, snapshot, loading, track]);

  React.useEffect(() => {
    if (step !== "child_interests" || !activeChildId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/children/${activeChildId}`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          child?: { systemInterests?: { interestSlug: string }[] };
        };
        const slugs =
          data.child?.systemInterests?.map((x) => x.interestSlug) ?? [];
        if (!cancelled) setSelectedInterests(slugs);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, activeChildId]);

  const roleChipItems = React.useMemo<ChipItem[]>(
    () =>
      FAMILY_ROLE_OPTIONS.map((r) => ({
        id: r.value,
        label: r.label,
        active: familyRole === r.value,
        onClick: () => setFamilyRole(r.value),
      })),
    [familyRole],
  );

  const interestChipItems = React.useMemo<ChipItem[]>(
    () =>
      interests.map((i) => ({
        id: i.value,
        label: i.label,
        active: selectedInterests.includes(i.value),
        onClick: () => {
          setSelectedInterests((prev) =>
            prev.includes(i.value)
              ? prev.filter((x) => x !== i.value)
              : [...prev, i.value],
          );
        },
      })),
    [interests, selectedInterests],
  );

  const handleSaveAdult = async () => {
    setError("");
    // Role is optional and never blocks — only persist it if the user picked one.
    setLoading(true);
    try {
      if (familyRole) {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ familyRole }),
        });
        if (!res.ok) throw new Error("save");
        notifyFamilyPersonasChanged();
      }
      track("completion_step_completed", { completionStep: "adult" });
      await refreshState();
      setStep(nextStepAfterAdultSave());
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChild = async () => {
    setError("");
    if (birthMonth === "" || birthYear === "") {
      setError("Выберите месяц и год рождения");
      return;
    }
    const month = Number(birthMonth);
    const year = Number(birthYear);
    const birthDate = toBirthIso(month, year);
    const name = childName.trim() || "Ребёнок";
    setLoading(true);
    try {
      if (activeChildId && !addingAnotherChild) {
        // This step never touches interests — omit both fields entirely so
        // the non-destructive PUT leaves whatever interests already exist.
        const res = await fetch(`/api/children/${activeChildId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, birthDate }),
        });
        if (!res.ok) throw new Error("save");
      } else {
        const res = await fetch("/api/children", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name,
            birthDate,
            systemInterests: [],
            customInterests: [],
          }),
        });
        if (!res.ok) throw new Error("save");
        const payload = await res.json().catch(() => ({}));
        const newId =
          payload &&
          typeof payload === "object" &&
          "child" in payload &&
          (payload as { child?: { id?: string } }).child?.id;
        if (typeof newId === "string") {
          setActiveChildId(newId);
        }
      }
      setAddingAnotherChild(false);
      track("completion_step_completed", { completionStep: "child" });
      await refreshState();
      setStep(nextStepAfterChildSave());
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterests = async () => {
    if (!activeChildId || selectedInterests.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const childRes = await fetch(`/api/children/${activeChildId}`, {
        credentials: "include",
      });
      if (!childRes.ok) throw new Error("load");
      const data = await childRes.json();
      const c = data.child as { name: string; birthDate: string | null };
      // This step only manages system interests (chip picker, no custom-interest
      // UI) — omit customInterests so any existing custom interests survive.
      const res = await fetch(`/api/children/${activeChildId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: c.name,
          birthDate: c.birthDate,
          systemInterests: selectedInterests,
        }),
      });
      if (!res.ok) throw new Error("save");
      notifyFamilyPersonasChanged();
      track("completion_step_completed", { completionStep: "child_interests" });
      trackChildContextCompleted();
      await refreshState();
      setStep(nextStepAfterInterests());
    } catch {
      setError("Не удалось сохранить интересы");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipInterests = () => {
    track("completion_step_completed", { completionStep: "child_interests", skipped: true });
    setStep(nextStepAfterInterests());
  };

  const handleAddAnotherChild = () => {
    track("completion_additional_child_added", {});
    setAddingAnotherChild(true);
    setActiveChildId(null);
    setChildName("");
    setBirthMonth("");
    setBirthYear("");
    setSelectedInterests([]);
    setStep("child");
  };

  const handleFinish = () => {
    track("completion_finished", {});
    trackOnboardingCompleted();
    onFinished({ alreadyComplete: false });
  };

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[200px] items-center justify-center px-6">
        <p className="text-sm text-neutral-500">Загрузка…</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.refresh()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-5 pb-8 pt-2">
      <CompletionProgressBar step={step} />

      {step === "adult" && (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Кто вы в семье?</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Необязательно — поможет подбирать форматы и активности
            </p>
          </div>
          <ChipsRow items={roleChipItems} layout="masonry" className="max-h-[200px]" />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            className="w-full rounded-2xl font-semibold"
            size="lg"
            disabled={loading}
            onClick={() => void handleSaveAdult()}
          >
            Далее
          </Button>
        </div>
      )}

      {step === "child" && (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              {addingAnotherChild ? "Ещё один ребёнок" : "Первый ребёнок"}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Укажите имя (по желанию) и примерный возраст
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-name">Имя</Label>
            <Input
              id="cc-name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Как зовут"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Месяц рождения</Label>
              <FilterSelect
                value={birthMonth}
                onChange={setBirthMonth}
                options={BIRTH_MONTH_OPTIONS}
                placeholder="Месяц"
                aria-label="Месяц рождения"
              />
            </div>
            <div className="space-y-2">
              <Label>Год рождения</Label>
              <FilterSelect
                value={birthYear}
                onChange={setBirthYear}
                options={birthYearOptions()}
                placeholder="Год"
                aria-label="Год рождения"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            className="w-full rounded-2xl font-semibold"
            size="lg"
            disabled={birthMonth === "" || birthYear === "" || loading}
            onClick={() => void handleSaveChild()}
          >
            Далее
          </Button>
        </div>
      )}

      {step === "child_interests" && (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Интересы ребёнка</h3>
            <p className="mt-1 text-sm text-neutral-500">Необязательно — можно пропустить</p>
          </div>
          {interestsLoading ? (
            <p className="text-sm text-neutral-500">Загрузка интересов…</p>
          ) : interestsError ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600">Не удалось загрузить список интересов</p>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => retryInterests()}
              >
                Повторить
              </Button>
            </div>
          ) : (
            <ChipsRow
              items={interestChipItems}
              layout="masonry"
              className="max-h-[min(50vh,320px)] overflow-y-auto pr-1"
            />
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            className="w-full rounded-2xl font-semibold"
            size="lg"
            disabled={
              interestsLoading || Boolean(interestsError) || selectedInterests.length === 0 || loading
            }
            onClick={() => void handleSaveInterests()}
          >
            Далее
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm font-medium text-neutral-500 hover:text-neutral-700"
            disabled={loading}
            onClick={handleSkipInterests}
          >
            Пропустить
          </button>
        </div>
      )}

      {step === "add_more_children" && (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Профиль готов</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Можно добавить ещё детей для точных подборок
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-2xl font-semibold"
            size="lg"
            onClick={handleAddAnotherChild}
          >
            Добавить ещё ребёнка
          </Button>
          <Button
            className="w-full rounded-2xl font-semibold"
            size="lg"
            onClick={handleFinish}
          >
            Продолжить
          </Button>
        </div>
      )}
    </div>
  );
}
