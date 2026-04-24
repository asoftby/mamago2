"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { CompactSaveAuthPanel } from "@/components/auth/CompactSaveAuthPanel";
import { SaveFlowContainer } from "./SaveFlowContainer";
import { cn } from "@/lib/utils";
import {
  SaveToPlanPickerBody,
  type SaveScenario,
  type SaveToPlanResult,
} from "@/components/activity/SaveToPlanModal";
import { ProfileCompletionFlow } from "@/components/post-auth/ProfileCompletionFlow";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  savePostAuthContext,
  clearPostAuthContext,
  applyPostAuthCompletionOutcome,
  trackAuthCompleted,
} from "@/lib/post-auth";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";
import type { ProfileStatePayload } from "@/lib/post-auth/types";

export type SaveActivityFlowAdaptiveProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  scenario: SaveScenario;
  isIdea?: boolean;
  inPlan?: boolean;
  planDate?: string | null;
  planStartsAt?: string | null;
  onPersist: (result: SaveToPlanResult) => Promise<void>;
  nextHref?: string;
};

type Phase = "select" | "auth" | "completion" | "success";

function authCopy(result: SaveToPlanResult | null): { title: string; subtitle: string } {
  if (!result || result.action === "cancel") {
    return {
      title: "Войдите, чтобы сохранить",
      subtitle: "Сохраняйте события в план и в идеи",
    };
  }
  if (result.action === "plan") {
    return {
      title: "Войдите, чтобы добавить в план",
      subtitle: "После входа выбранная дата сохранится автоматически",
    };
  }
  if (result.action === "ideas") {
    return {
      title: "Войдите, чтобы сохранить в идеи",
      subtitle: "После входа событие появится в вашем списке",
    };
  }
  return {
    title: "Войдите, чтобы продолжить",
    subtitle: "Изменения в идеях синхронизируются с аккаунтом",
  };
}

/**
 * Адаптивный save flow с единым контейнером.
 * 
 * Desktop: Dialog (modal)
 * Mobile: Sheet (full-screen bottom sheet)
 * 
 * Фазы:
 * 1. select — выбор опции (план/идеи)
 * 2. auth — вход/регистрация (если не авторизован)
 * 3. success — успешное сохранение
 * 
 * Все фазы происходят внутри одного контейнера.
 */
export function SaveActivityFlowAdaptive({
  open,
  onOpenChange,
  isAuthenticated,
  scenario,
  isIdea = false,
  inPlan = false,
  planDate = null,
  planStartsAt = null,
  onPersist,
  nextHref,
}: SaveActivityFlowAdaptiveProps) {
  const router = useRouter();
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const [phase, setPhase] = React.useState<Phase>("select");
  const [pending, setPending] = React.useState<SaveToPlanResult | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPhase("select");
      setPending(null);
    }
  }, [open]);

  const resolvedNext =
    nextHref ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");

  const runPersist = React.useCallback(
    async (result: SaveToPlanResult) => {
      if (result.action === "cancel") return;
      await onPersist(result);
    },
    [onPersist],
  );

  const handleCommit = React.useCallback(
    async (result: SaveToPlanResult) => {
      if (result.action === "cancel") return;

      if (isAuthenticated) {
        try {
          await runPersist(result);
          onOpenChange(false);
        } catch {
          // тост ошибки — у родителя (onPersist)
        }
        return;
      }

      // Сохраняем pending action и переходим на auth
      setPending(result);
      if (typeof window !== "undefined") {
        savePostAuthContext({
          source: result.action === "ideas" ? "save_idea" : "save_plan",
          pendingAction: null,
          returnTo: `${window.location.pathname}${window.location.search}`,
        });
      }
      setPhase("auth");
    },
    [isAuthenticated, onOpenChange, runPersist],
  );

  const finishSuccess = React.useCallback(() => {
    setPhase("success");
    window.setTimeout(() => {
      onOpenChange(false);
    }, 1000);
  }, [onOpenChange]);

  const handleAuthSuccess = React.useCallback(async () => {
    if (!pending || pending.action === "cancel") {
      setPhase("select");
      return;
    }
    try {
      trackAuthCompleted(
        pending.action === "ideas" ? "save_idea" : "save_plan",
      );
      await runPersist(pending);
      trackPostAuthEvent("pending_action_executed", {
        kind: pending.action,
      });
      clearPostAuthContext();

      const res = await fetch("/api/me/profile-state", { credentials: "include" });
      const profile = (await res.json()) as ProfileStatePayload;
      if (!res.ok) {
        finishSuccess();
        return;
      }

      if (!profile.isProfileComplete) {
        setPhase("completion");
        return;
      }

      applyPostAuthCompletionOutcome(
        pending.action === "ideas" ? "save_idea" : "save_plan",
        {
          isMobile,
          router,
          returnTo:
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : null,
          toast,
        },
      );
      finishSuccess();
    } catch {
      // тост у onPersist; остаёмся на шаге входа
    }
  }, [pending, runPersist, finishSuccess, isMobile, router]);

  const handleCompletionFinished = React.useCallback(
    (opts?: { alreadyComplete?: boolean }) => {
      if (!pending || pending.action === "cancel") {
        finishSuccess();
        return;
      }
      if (opts?.alreadyComplete !== true) {
        applyPostAuthCompletionOutcome(
          pending.action === "ideas" ? "save_idea" : "save_plan",
          {
            isMobile,
            router,
            returnTo:
              typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}`
                : null,
            toast,
          },
        );
      }
      router.refresh();
      finishSuccess();
    },
    [pending, finishSuccess, isMobile, router],
  );

  const body = (
    <div
      className={cn(
        "flex flex-col",
        phase === "auth" || phase === "completion" ? "h-full" : "min-h-[420px]",
      )}
    >
      {phase === "select" && (
        <SaveToPlanPickerBody
          key="pick"
          scenario={scenario}
          isIdea={isIdea}
          inPlan={inPlan}
          planDate={planDate}
          planStartsAt={planStartsAt}
          onCommit={handleCommit}
        />
      )}
      {phase === "auth" && pending && (
        <div className="flex flex-col h-full overflow-y-auto px-5 pt-5 pb-8">
          <div className="flex items-center justify-between mb-auto pb-6">
            <button
              type="button"
              onClick={() => { setPhase("select"); setPending(null); }}
              className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Назад
            </button>
            <ModalCloseButton onClick={() => onOpenChange(false)} />
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <CompactSaveAuthPanel
              embedded
              resetKey="auth"
              title={authCopy(pending).title}
              subtitle={authCopy(pending).subtitle}
              skipRedirect
              nextHref={resolvedNext}
              onAuthSuccess={handleAuthSuccess}
            />
          </div>
        </div>
      )}
      {phase === "completion" && pending && (
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
            <div className="w-16" />
            <ModalCloseButton
              onClick={() => {
                trackPostAuthEvent("completion_abandoned", {
                  entryPoint:
                    pending.action === "ideas" ? "save_idea" : "save_plan",
                });
                onOpenChange(false);
              }}
            />
          </div>
          <ProfileCompletionFlow
            entryPoint={pending.action === "ideas" ? "save_idea" : "save_plan"}
            returnTo={
              typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}`
                : null
            }
            onFinished={handleCompletionFinished}
          />
        </div>
      )}
      {phase === "success" && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-12">
          <CheckCircle2 className="h-14 w-14 text-green-500" aria-hidden />
          <p className="text-center text-[15px] font-semibold text-neutral-900">
            Сохранено
          </p>
          <p className="text-center text-sm text-neutral-500">
            Готово — можно продолжать просмотр
          </p>
        </div>
      )}
    </div>
  );

  return (
    <SaveFlowContainer
      open={open}
      onOpenChange={onOpenChange}
      title="Сохранить активность"
      fixedHeight={phase === "auth" || phase === "completion"}
    >
      {body}
    </SaveFlowContainer>
  );
}
