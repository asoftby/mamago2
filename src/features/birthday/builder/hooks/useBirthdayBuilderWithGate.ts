"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  useBirthdayBuilder,
  parseAgeFromSearchParams,
  type ProfileChildPayload,
} from "./useBirthdayBuilder";
import { useAuthMe } from "./useAuthMe";
import { useBirthdayBuilderAuth } from "../context/BirthdayBuilderAuthContext";
import {
  saveBirthdayBuilderDraft,
  loadBirthdayBuilderDraft,
  clearBirthdayBuilderDraft,
} from "../lib/birthdayBuilderDraftStorage";
import {
  setPendingBirthdayBuilderAction,
  clearPendingBirthdayBuilderAction,
  consumePendingBirthdayBuilderAction,
} from "../lib/pendingBirthdayBuilderAction";
import { ageYearsFromBirthDate, formatYearsRu } from "../lib/partyChildUtils";

/**
 * Конструктор: без логина — черновик в localStorage; gate на добавление услуг,
 * переход к подтверждению и отправку заявок.
 */
export function useBirthdayBuilderWithGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefilledAge = parseAgeFromSearchParams(searchParams);
  const builder = useBirthdayBuilder(prefilledAge ? { ageGroup: prefilledAge } : undefined);

  const { isAuthenticated, isLoading, refetch, isEmailVerified } = useAuthMe();
  const { openAuthModal } = useBirthdayBuilderAuth();

  const guestHydratedRef = useRef(false);
  const postLoginHandledRef = useRef(false);
  const postLoginPromptResolvedRef = useRef(false);

  const [postLoginChildModalOpen, setPostLoginChildModalOpen] = useState(false);
  const [postLoginChildrenList, setPostLoginChildrenList] = useState<
    ProfileChildPayload[]
  >([]);

  /** Гость: восстановить черновик один раз */
  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (guestHydratedRef.current) return;
    guestHydratedRef.current = true;
    const draft = loadBirthdayBuilderDraft();
    if (draft) {
      builder.replaceState(draft);
    }
  }, [isLoading, isAuthenticated, builder.replaceState, builder]);

  /** После входа (bbAuth): черновик + отложенное действие + опционально выбор ребёнка из профиля */
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (postLoginHandledRef.current) return;
    const hasBbAuth = searchParams.get("bbAuth") === "1";
    if (!hasBbAuth) {
      postLoginHandledRef.current = true;
      return;
    }
    postLoginHandledRef.current = true;
    const draft = loadBirthdayBuilderDraft();
    if (draft) {
      builder.replaceState(draft);
      clearBirthdayBuilderDraft();
    }
    const pending = consumePendingBirthdayBuilderAction();
    if (pending?.type === "selectBase") {
      builder.selectBase(pending.offerId);
    } else if (pending?.type === "toggleAddon") {
      builder.toggleAddon(pending.offerId);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("bbAuth");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

    const alreadyLinkedProfile =
      draft?.quiz?.partyForChild?.profileChildId != null;
    if (alreadyLinkedProfile) return;

    void (async () => {
      try {
        const res = await fetch("/api/children");
        if (!res.ok) return;
        const data = (await res.json()) as {
          children?: ProfileChildPayload[];
        };
        const children = data.children ?? [];
        if (children.length === 0) return;
        postLoginPromptResolvedRef.current = false;
        setPostLoginChildrenList(children);
        setPostLoginChildModalOpen(true);
      } catch {
        /* noop */
      }
    })();
  }, [
    isLoading,
    isAuthenticated,
    searchParams,
    pathname,
    router,
    builder.replaceState,
    builder.selectBase,
    builder.toggleAddon,
  ]);

  const resolvePostLoginChildChoice = useCallback(
    (choice: "manual" | ProfileChildPayload) => {
      if (postLoginPromptResolvedRef.current) return;
      postLoginPromptResolvedRef.current = true;

      if (choice === "manual") {
        builder.confirmManualScenarioAfterLogin();
        toast.success("Вы продолжаете с текущими параметрами", {
          description: "Все выбранные услуги сохранены",
        });
      } else {
        builder.applyProfileChildToScenario(choice);
        const birthIso = choice.birthDate.slice(0, 10);
        const years = ageYearsFromBirthDate(birthIso);
        toast.success(
          `Сценарий обновлён под ребёнка: ${choice.name}, ${formatYearsRu(years)}`,
          {
            description:
              "Мы обновили возраст и интересы для более точного сценария",
          },
        );
      }
      setPostLoginChildModalOpen(false);
      setPostLoginChildrenList([]);
    },
    [builder],
  );

  const handlePostLoginModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (!postLoginPromptResolvedRef.current) {
          resolvePostLoginChildChoice("manual");
        }
        setPostLoginChildModalOpen(false);
      }
    },
    [resolvePostLoginChildChoice],
  );

  /** Возврат с логина */
  useEffect(() => {
    if (searchParams.get("bbAuth") === "1") {
      void refetch();
    }
  }, [searchParams, refetch]);

  /** Автосохранение черновика для гостя */
  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const t = window.setTimeout(() => {
      saveBirthdayBuilderDraft(builder.state);
    }, 400);
    return () => window.clearTimeout(t);
  }, [builder.state, isLoading, isAuthenticated]);

  const selectBase = useCallback(
    (offerId: string) => {
      if (isLoading) return;
      const cur = builder.state.selection.selectedBaseId;
      if (cur === offerId) {
        builder.selectBase(offerId);
        return;
      }
      if (!isAuthenticated) {
        setPendingBirthdayBuilderAction({ type: "selectBase", offerId });
        openAuthModal();
        return;
      }
      builder.selectBase(offerId);
    },
    [builder, isAuthenticated, isLoading, openAuthModal],
  );

  const replaceBase = useCallback(
    (newOfferId: string) => {
      if (isLoading) return;
      if (!isAuthenticated) {
        setPendingBirthdayBuilderAction({ type: "selectBase", offerId: newOfferId });
        openAuthModal();
        return;
      }
      builder.replaceBase(newOfferId);
    },
    [builder, isAuthenticated, isLoading, openAuthModal],
  );

  const toggleAddon = useCallback(
    (offerId: string) => {
      if (isLoading) return;
      const isSelected = builder.state.selection.selectedAddonIds.includes(offerId);
      if (isSelected) {
        builder.toggleAddon(offerId);
        return;
      }
      if (!isAuthenticated) {
        setPendingBirthdayBuilderAction({ type: "toggleAddon", offerId });
        openAuthModal();
        return;
      }
      builder.toggleAddon(offerId);
    },
    [builder, isAuthenticated, isLoading, openAuthModal],
  );

  const nextStep = useCallback(() => {
    if (isLoading) return;
    const step = builder.state.ui.currentStep;
    if (step === "summary" && !isAuthenticated) {
      openAuthModal();
      return;
    }
    builder.nextStep();
  }, [builder, isAuthenticated, isLoading, openAuthModal]);

  const resetBuilder = useCallback(() => {
    clearBirthdayBuilderDraft();
    clearPendingBirthdayBuilderAction();
    setPostLoginChildModalOpen(false);
    setPostLoginChildrenList([]);
    builder.resetBuilder();
  }, [builder]);

  return {
    ...builder,
    selectBase,
    replaceBase,
    toggleAddon,
    nextStep,
    resetBuilder,
    isAuthenticated,
    isEmailVerified,
    isAuthLoading: isLoading,
    requestLoginToSubmit: openAuthModal,
    postLoginChildModalOpen,
    postLoginChildrenList,
    resolvePostLoginChildChoice,
    handlePostLoginModalOpenChange,
  };
}

export type BirthdayBuilderWithGate = ReturnType<typeof useBirthdayBuilderWithGate>;
