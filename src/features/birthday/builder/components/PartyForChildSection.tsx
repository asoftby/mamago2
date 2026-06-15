"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BirthdayBuilderWithGate } from "../hooks/useBirthdayBuilderWithGate";
import type { BirthdayAgeSignalsState } from "../hooks/useBirthdayAgeSignals";
import type { PartyForChild } from "../types/builder";
import {
  chipLabelForAgeOption,
  filterAgeOptionsForBirthdayBuilder,
  mapSignalToBuilderAgeGroup,
  pickAgeSignalOptionForYears,
} from "../lib/ageSignalMapper";
import { ageYearsFromBirthDate, formatYearsRu } from "../lib/partyChildUtils";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { SavedProfileChildCard } from "./SavedProfileChildCard";
import { DatePicker } from "@/components/ui/date-picker";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { buildAuthUrl } from "@/lib/auth/redirectTo";

type BuilderHook = BirthdayBuilderWithGate;

const CHILD_PICKER_TITLE = "Выберите, для кого праздник";
const CHILD_PICKER_DESCRIPTION =
  "Мы используем возраст и интересы ребёнка для более точного подбора праздника";

function ChildPickerPanelSections({
  variant,
  loadingChildren,
  isLoggedIn,
  profileChildren,
  partyForChild,
  loginHref,
  onPickRow,
  onClearSelection,
  onEdit,
  onAdd,
}: {
  variant: "dialog" | "sheet";
  loadingChildren: boolean;
  isLoggedIn: boolean;
  profileChildren: ApiChild[];
  partyForChild: PartyForChild | null;
  loginHref: string;
  onPickRow: (c: ApiChild) => void;
  onClearSelection: () => void;
  onEdit: () => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loadingChildren ? (
          <div className="space-y-2 px-1 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : !isLoggedIn && profileChildren.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground leading-relaxed">
            <Link
              href={loginHref}
              className="font-medium text-[#EF8759] underline underline-offset-2 hover:text-[#d9733f]"
            >
              Войдите в аккаунт
            </Link>
            , чтобы подтянуть детей из профиля, или добавьте ребёнка вручную ниже.
          </p>
        ) : isLoggedIn && profileChildren.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            В профиле пока нет детей. Добавьте ребёнка ниже.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Список детей">
            {profileChildren.map((c) => {
              const rowLabel = `${c.name} · ${formatYearsRu(ageYearsFromBirthDate(birthIsoFromApi(c.birthDate)))}`;
              const selected = isProfileChildRowSelected(partyForChild, c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPickRow(c)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors",
                      selected
                        ? "bg-orange-50 text-foreground ring-1 ring-[#EF8759]/30"
                        : "hover:bg-muted/60 active:bg-muted/80",
                    )}
                  >
                    <span className="min-w-0 truncate">{rowLabel}</span>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center"
                      aria-hidden
                    >
                      {selected ? (
                        <Check className="h-5 w-5 text-[#EF8759]" />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 border-t border-border/50 px-4 pt-3",
          variant === "sheet"
            ? "pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "pb-4",
        )}
      >
        {partyForChild && (
          <button
            type="button"
            onClick={onClearSelection}
            className="w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Продолжить без выбора ребёнка
          </button>
        )}
        {partyForChild && (
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Изменить данные
          </button>
        )}
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-semibold",
            "text-muted-foreground hover:text-foreground hover:border-[#EF8759]/50 hover:bg-orange-50/20",
            "transition-colors",
          )}
        >
          + Добавить ребёнка
        </button>
      </div>
    </>
  );
}

type ApiChild = {
  id: string;
  name: string;
  birthDate: string;
  systemInterests?: { interestSlug: string }[];
};

function birthIsoFromApi(d: string): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function childToParty(c: ApiChild): PartyForChild {
  const iso = birthIsoFromApi(c.birthDate);
  const years = ageYearsFromBirthDate(iso);
  return {
    profileChildId: c.id,
    name: c.name.trim(),
    ageLabel: formatYearsRu(years),
    birthDateIso: iso,
    interestSlugs:
      c.systemInterests?.map((x) => x.interestSlug).filter(Boolean) ?? [],
  };
}

function applyAgeFromBirthDate(
  birthDateIso: string,
  ageOptions: ReturnType<typeof filterAgeOptionsForBirthdayBuilder>,
  setBasics: BuilderHook["setBasics"],
) {
  const years = ageYearsFromBirthDate(birthDateIso);
  const opt = pickAgeSignalOptionForYears(years, ageOptions);
  if (!opt) return;
  const ageGroup = mapSignalToBuilderAgeGroup(opt);
  setBasics({
    ageGroup,
    selectedAgeSignalId: opt.id,
    selectedAgeLabel: chipLabelForAgeOption(opt),
  });
}

function isProfileChildRowSelected(
  party: PartyForChild | null,
  child: ApiChild,
): boolean {
  return Boolean(party?.profileChildId && party.profileChildId === child.id);
}

interface PartyForChildSectionProps {
  builder: BuilderHook;
  ageSignals: BirthdayAgeSignalsState;
}

function PartyForChildSectionInner({
  builder,
  ageSignals,
}: PartyForChildSectionProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const { state, setPartyForChild, setBasics } = builder;
  const partyForChild = state.quiz.partyForChild;

  const { options: rawAgeOptions, loading: ageLoading } = ageSignals;
  const ageOptions = useMemo(
    () => filterAgeOptionsForBirthdayBuilder(rawAgeOptions),
    [rawAgeOptions],
  );

  const [children, setChildren] = useState<ApiChild[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [addModalLead, setAddModalLead] = useState<"default" | "postLogin">(
    "default",
  );
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [interestPick, setInterestPick] = useState<Set<string>>(new Set());
  const [savingProfile, setSavingProfile] = useState(false);

  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const appliedAgeForChildKey = useRef<string | null>(null);
  /** Один ребёнок в профиле — автовыбор один раз при загрузке, без повторного навязывания после «Сбросить» */
  const didAutoSelectSingleProfileChildRef = useRef(false);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const loginHref = useMemo(() => {
    const qs = searchParams.toString();
    const full = `${pathname}${qs ? `?${qs}` : ""}`;
    return buildAuthUrl({ redirectTo: full });
  }, [pathname, searchParams]);

  /** Обычная загрузка детей; при bbAuth=1 список подтягивает сценарий после логина */
  useEffect(() => {
    if (searchParams.get("bbAuth") === "1") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/children", {
          credentials: "same-origin",
        });
        if (!cancelled) setIsLoggedIn(res.ok);
        if (!res.ok) {
          if (!cancelled) setChildren([]);
          return;
        }
        const data = (await res.json()) as { children?: ApiChild[] };
        if (!cancelled)
          setChildren(Array.isArray(data.children) ? data.children : []);
      } catch {
        if (!cancelled) {
          setChildren([]);
          setIsLoggedIn(false);
        }
      } finally {
        if (!cancelled) setLoadingChildren(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const toggleInterest = useCallback((slug: string) => {
    setInterestPick((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const resetModal = useCallback(() => {
    setName("");
    setBirthDate("");
    setInterestPick(new Set());
  }, []);

  const handleSelectChild = useCallback(
    (c: ApiChild) => {
      const party = childToParty(c);
      setPartyForChild(party);
    },
    [setPartyForChild],
  );

  /** Редактирование из карточки: не смешиваем с выбором — отдельная кнопка с stopPropagation */
  const handleEditChildCard = useCallback(
    (c: ApiChild) => {
      const party = childToParty(c);
      setPartyForChild(party);
      setModalMode("edit");
      setName(c.name.trim());
      setBirthDate(birthIsoFromApi(c.birthDate));
      setInterestPick(
        new Set(
          c.systemInterests?.map((x) => x.interestSlug).filter(Boolean) ?? [],
        ),
      );
      setModalOpen(true);
    },
    [setPartyForChild],
  );

  /** Один ребёнок в профиле — сразу в сценарии и в selected-state карточки */
  useEffect(() => {
    if (loadingChildren || !isLoggedIn) return;
    if (children.length !== 1) return;
    if (partyForChild) return;
    if (didAutoSelectSingleProfileChildRef.current) return;
    const only = children[0];
    if (!only) return;
    didAutoSelectSingleProfileChildRef.current = true;
    handleSelectChild(only);
  }, [
    loadingChildren,
    isLoggedIn,
    children,
    partyForChild,
    handleSelectChild,
  ]);

  const openAddModal = useCallback(
    (opts?: { variant?: "postLogin" }) => {
      setModalMode("add");
      resetModal();
      setAddModalLead(opts?.variant === "postLogin" ? "postLogin" : "default");
      setModalOpen(true);
    },
    [resetModal],
  );

  const openChildPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const handlePickChildRow = useCallback(
    (c: ApiChild) => {
      handleSelectChild(c);
      setPickerOpen(false);
    },
    [handleSelectChild],
  );

  const handleClear = useCallback(() => {
    appliedAgeForChildKey.current = null;
    setPartyForChild(null);
    setBasics({ ageGroup: null });
    setSavePromptOpen(false);
  }, [setPartyForChild, setBasics]);

  const openEditModal = useCallback(() => {
    const p = state.quiz.partyForChild;
    if (!p) return;
    setModalMode("edit");
    setName(p.name);
    setBirthDate(p.birthDateIso);
    setInterestPick(new Set(p.interestSlugs));
    setModalOpen(true);
  }, [state.quiz.partyForChild]);

  const handleAddFromPicker = useCallback(() => {
    setPickerOpen(false);
    openAddModal();
  }, [openAddModal]);

  const handleEditFromPicker = useCallback(() => {
    setPickerOpen(false);
    openEditModal();
  }, [openEditModal]);

  const handleClearFromPicker = useCallback(() => {
    handleClear();
    setPickerOpen(false);
  }, [handleClear]);

  const postLoginBbAuthRef = useRef(false);

  /** После логина с ?bbAuth=1: подтянуть детей и сразу продолжить сценарий */
  useEffect(() => {
    if (searchParams.get("bbAuth") !== "1") return;
    if (postLoginBbAuthRef.current) return;

    let cancelled = false;
    (async () => {
      let list: ApiChild[] = [];
      try {
        const res = await fetch("/api/children", {
          credentials: "same-origin",
        });
        if (cancelled) return;
        const loggedIn = res.ok;
        setIsLoggedIn(loggedIn);
        if (loggedIn) {
          const data = (await res.json()) as { children?: ApiChild[] };
          list = Array.isArray(data.children) ? data.children : [];
          setChildren(list);
        } else {
          setChildren([]);
        }
      } catch {
        if (!cancelled) {
          setChildren([]);
          setIsLoggedIn(false);
        }
      } finally {
        if (!cancelled) setLoadingChildren(false);
      }
      if (cancelled) return;

      postLoginBbAuthRef.current = true;

      const params = new URLSearchParams(searchParams.toString());
      params.delete("bbAuth");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

      toast.success("Вы вошли в аккаунт");

      if (list.length === 0) {
        openAddModal({ variant: "postLogin" });
      } else if (list.length === 1) {
        didAutoSelectSingleProfileChildRef.current = true;
        handleSelectChild(list[0]!);
      } else {
        setPickerOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    pathname,
    router,
    handleSelectChild,
    openAddModal,
  ]);

  /** Один раз подставить age signal из даты рождения выбранного ребёнка (не перетирать ручной выбор чипов) */
  useEffect(() => {
    const p = state.quiz.partyForChild;
    if (!p?.birthDateIso || ageOptions.length === 0) return;
    const key = `${p.profileChildId ?? "local"}:${p.birthDateIso}`;
    if (appliedAgeForChildKey.current === key) return;
    appliedAgeForChildKey.current = key;
    applyAgeFromBirthDate(p.birthDateIso, ageOptions, setBasics);
  }, [state.quiz.partyForChild, ageOptions, setBasics]);

  const handleModalDone = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Введите имя (от 2 символов)");
      return;
    }
    if (!birthDate || birthDate.length < 10) {
      toast.error("Укажите дату рождения");
      return;
    }
    const bd = new Date(birthDate + "T12:00:00");
    if (Number.isNaN(bd.getTime())) {
      toast.error("Некорректная дата");
      return;
    }
    const years = ageYearsFromBirthDate(birthDate);
    if (years < 0 || years > 17) {
      toast.error("Возраст для детского праздника: 0–17 лет");
      return;
    }

    const slugs = Array.from(interestPick);

    if (modalMode === "edit") {
      const current = state.quiz.partyForChild;
      if (!current) return;
      const party: PartyForChild = {
        ...current,
        name: trimmed,
        ageLabel: formatYearsRu(years),
        birthDateIso: birthDate,
        interestSlugs: slugs,
      };
      setPartyForChild(party);
      if (current.profileChildId) {
        setChildren((prev) =>
          prev.map((ch) =>
            ch.id === current.profileChildId
              ? {
                  ...ch,
                  name: trimmed,
                  birthDate: `${birthDate}T00:00:00.000Z`,
                  systemInterests: slugs.map((interestSlug) => ({ interestSlug })),
                }
              : ch,
          ),
        );
      }
      setModalOpen(false);
      resetModal();
      setModalMode("add");
      toast.success("Данные обновлены");
      return;
    }

    const party: PartyForChild = {
      profileChildId: null,
      name: trimmed,
      ageLabel: formatYearsRu(years),
      birthDateIso: birthDate,
      interestSlugs: slugs,
    };

    setPartyForChild(party);
    setModalOpen(false);
    resetModal();

    if (isLoggedIn) {
      setSavePromptOpen(true);
    } else {
      toast.message("Ребёнок учтён в подборе", {
        description: "Войдите в аккаунт, чтобы сохранить в профиль",
      });
    }
  }, [
    name,
    birthDate,
    interestPick,
    modalMode,
    state.quiz.partyForChild,
    setPartyForChild,
    resetModal,
    isLoggedIn,
  ]);

  const handleSaveToProfile = useCallback(async () => {
    const p = state.quiz.partyForChild;
    if (!p?.birthDateIso) {
      setSavePromptOpen(false);
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          birthDate: p.birthDateIso,
          systemInterests: p.interestSlugs,
          customInterests: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.child?.id) {
        setPartyForChild({
          ...p,
          profileChildId: data.child.id as string,
        });
        setChildren((prev) => {
          if (prev.some((x) => x.id === data.child.id)) return prev;
          return [
            {
              id: data.child.id,
              name: p.name,
              birthDate:
                data.child.birthDate ?? `${p.birthDateIso}T00:00:00.000Z`,
              systemInterests: p.interestSlugs.map((interestSlug: string) => ({
                interestSlug,
              })),
            },
            ...prev,
          ];
        });
        toast.success("Сохранили в профиле");
      } else {
        toast.error(
          typeof data.error === "string" ? data.error : "Не удалось сохранить",
        );
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSavingProfile(false);
      setSavePromptOpen(false);
    }
  }, [state.quiz.partyForChild, setPartyForChild]);

  const handleSkipProfileSave = useCallback(() => {
    setSavePromptOpen(false);
  }, []);

  const loading = loadingChildren || ageLoading;

  const birthDatePickerValue = useMemo(() => {
    if (!birthDate || birthDate.length < 10) return null;
    const d = new Date(`${birthDate}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [birthDate]);

  const handleBirthDatePickerChange = useCallback((d: Date | null) => {
    if (!d) {
      setBirthDate("");
      return;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setBirthDate(`${y}-${m}-${day}`);
  }, []);

  const showSavedProfileChildren =
    !loadingChildren && isLoggedIn && children.length > 0;

  return (
    <>
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Для кого праздник?
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Это поможет точнее подобрать возраст и интересы — можно пропустить и
            выбрать ниже
          </p>
        </div>

        {showSavedProfileChildren && (
          <div className="space-y-2">
            {children.map((c) => (
              <SavedProfileChildCard
                key={c.id}
                child={c}
                selected={isProfileChildRowSelected(partyForChild, c)}
                onSelect={() => handleSelectChild(c)}
                onEdit={() => handleEditChildCard(c)}
              />
            ))}
          </div>
        )}

        {loading ? (
          <div className="h-[4.25rem] rounded-xl bg-muted/50 animate-pulse" />
        ) : partyForChild ? (
          <button
            type="button"
            onClick={() => openAddModal()}
            className={cn(
              "w-full rounded-xl border-2 border-dashed border-border py-3 text-sm font-semibold",
              "text-muted-foreground hover:text-foreground hover:border-[#EF8759]/50 hover:bg-orange-50/20",
              "transition-colors",
            )}
          >
            + Добавить ребёнка
          </button>
        ) : (
          <button
            type="button"
            onClick={openChildPicker}
            className={cn(
              "w-full rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-semibold text-left",
              "text-muted-foreground hover:text-foreground hover:border-[#EF8759]/50 hover:bg-orange-50/20",
              "transition-colors",
            )}
          >
            + Указать ребёнка
          </button>
        )}
      </div>

      {isDesktop ? (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent
            className="flex max-h-[min(85vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
            showCloseButton
          >
            <DialogHeader className="space-y-2 border-b border-border/50 px-4 pb-3 pt-4 text-left">
              <DialogTitle className="text-lg">{CHILD_PICKER_TITLE}</DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                {CHILD_PICKER_DESCRIPTION}
              </DialogDescription>
            </DialogHeader>
            <ChildPickerPanelSections
              variant="dialog"
              loadingChildren={loadingChildren}
              isLoggedIn={isLoggedIn}
              profileChildren={children}
              partyForChild={partyForChild}
              loginHref={loginHref}
              onPickRow={handlePickChildRow}
              onClearSelection={handleClearFromPicker}
              onEdit={handleEditFromPicker}
              onAdd={handleAddFromPicker}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
          <SheetContent
            side="bottom"
            className="flex max-h-[min(85vh,640px)] flex-col gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="space-y-2 border-b border-border/50 px-4 pb-3 pt-4 text-left">
              <SheetTitle className="text-lg">{CHILD_PICKER_TITLE}</SheetTitle>
              <SheetDescription className="text-left text-xs leading-relaxed">
                {CHILD_PICKER_DESCRIPTION}
              </SheetDescription>
            </SheetHeader>
            <ChildPickerPanelSections
              variant="sheet"
              loadingChildren={loadingChildren}
              isLoggedIn={isLoggedIn}
              profileChildren={children}
              partyForChild={partyForChild}
              loginHref={loginHref}
              onPickRow={handlePickChildRow}
              onClearSelection={handleClearFromPicker}
              onEdit={handleEditFromPicker}
              onAdd={handleAddFromPicker}
            />
          </SheetContent>
        </Sheet>
      )}

      <AlertDialog open={savePromptOpen} onOpenChange={setSavePromptOpen}>
        <AlertDialogContent className="w-[min(100%,calc(100vw-2rem))] max-w-md overflow-x-hidden sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Сохранить этого ребёнка в ваш профиль?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Так в следующий раз не придётся заполнять заново
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex w-full flex-col gap-2 sm:flex-col">
            <AlertDialogCancel
              type="button"
              className="w-full min-w-0 whitespace-normal text-center"
              onClick={handleSkipProfileSave}
            >
              Продолжить без сохранения
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="w-full min-w-0 whitespace-normal text-center bg-[#EF8759] text-white hover:bg-[#e07848]"
              disabled={savingProfile}
              onClick={(e) => {
                e.preventDefault();
                void handleSaveToProfile();
              }}
            >
              {savingProfile ? "…" : "Сохранить и продолжить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            resetModal();
            setModalMode("add");
            setAddModalLead("default");
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>
              {modalMode === "edit"
                ? "Редактировать ребёнка"
                : "Добавить ребёнка"}
            </DialogTitle>
            <DialogDescription>
              {modalMode === "edit"
                ? "Изменения сразу учтём в подборе."
                : addModalLead === "postLogin"
                  ? "Добавьте ребёнка, чтобы мы подобрали праздник"
                  : "Данные сразу учтём в подборе. Сохранение в профиль — по желанию, после ввода."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label
                htmlFor="party-child-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Имя ребёнка
              </label>
              <input
                id="party-child-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Маша"
                autoComplete="given-name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#EF8759]/30"
              />
            </div>
            <div className="space-y-1.5">
              <span
                id="party-child-bd-label"
                className="block text-xs font-medium text-muted-foreground"
              >
                Дата рождения
              </span>
              <div
                className="rounded-lg border border-border bg-background p-2 sm:p-3"
                aria-labelledby="party-child-bd-label"
              >
                <DatePicker
                  key={birthDate || "birth-empty"}
                  value={birthDatePickerValue}
                  onDateChange={handleBirthDatePickerChange}
                  disablePast={false}
                  placeholder="Выберите дату рождения"
                  showAge
                  className="w-full [&_.bg-white]:bg-transparent"
                />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Интересы
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SYSTEM_INTERESTS.map((it) => {
                  const on = interestPick.has(it.slug);
                  return (
                    <button
                      key={it.slug}
                      type="button"
                      onClick={() => toggleInterest(it.slug)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        on
                          ? "border-[#EF8759] bg-orange-50 text-[#c45a30]"
                          : "border-border bg-white text-muted-foreground hover:border-[#EF8759]/40",
                      )}
                    >
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 order-2 sm:order-1"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleModalDone}
              className={cn(
                "order-1 sm:order-2 rounded-lg bg-[#EF8759] text-white px-5 py-2.5 text-sm font-semibold",
                "hover:bg-[#e07848] disabled:opacity-50",
              )}
            >
              Готово
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PartyForChildSection(props: PartyForChildSectionProps) {
  return (
    <Suspense
      fallback={
        <div className="h-14 rounded-xl bg-muted/50 animate-pulse" />
      }
    >
      <PartyForChildSectionInner {...props} />
    </Suspense>
  );
}
