"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CompactSaveAuthPanel } from "@/components/auth/CompactSaveAuthPanel";
import {
  SaveToPlanPickerBody,
  type SaveScenario,
  type SaveToPlanResult,
} from "@/components/activity/SaveToPlanModal";
import { useSaveIntent } from "@/lib/save/SaveIntentContext";

export type SaveActivityFlowV2Props = {
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

type Phase = "select" | "auth" | "success";

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
 * Улучшенный SaveActivityFlow с поддержкой SaveIntentContext.
 * Предотвращает двойное открытие модалок через единый механизм deferred actions.
 */
export function SaveActivityFlowV2({
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
}: SaveActivityFlowV2Props) {
  const { pendingIntent, clearPendingIntent } = useSaveIntent();
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
      setPhase("auth");
    },
    [isAuthenticated, onOpenChange, runPersist],
  );

  const handleAuthSuccess = React.useCallback(async () => {
    if (!pending || pending.action === "cancel") {
      setPhase("select");
      return;
    }
    try {
      await runPersist(pending);
      setPhase("success");
      clearPendingIntent();
      window.setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch {
      // тост у onPersist; остаёмся на шаге входа
    }
  }, [pending, onOpenChange, runPersist, clearPendingIntent]);

  const body = (
    <div className="flex flex-col">
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
        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-3 pb-4 pt-1 sm:px-5">
          <CompactSaveAuthPanel
            embedded
            resetKey="auth"
            title={authCopy(pending).title}
            subtitle={authCopy(pending).subtitle}
            skipRedirect
            nextHref={resolvedNext}
            onBack={() => {
              setPhase("select");
              setPending(null);
            }}
            onAuthSuccess={handleAuthSuccess}
          />
        </div>
      )}
      {phase === "success" && (
        <div className="flex flex-col items-center gap-3 px-6 py-12">
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-neutral-100 bg-white p-0 shadow-2xl",
          "sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2",
        )}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <SheetTitle className="sr-only">Сохранить активность</SheetTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </SheetContent>
    </Sheet>
  );
}
