"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { AuthForm } from "@/components/auth/AuthForm";
import { MyPlanFlowShell } from "./MyPlanFlowShell";
import { MyPlanDayTimelinePreview } from "./MyPlanDayTimelinePreview";
import { myPlanUnauthFlowRootClassName } from "./myPlanUnauthLayout";
import { ProfileCompletionFlow } from "@/components/post-auth/ProfileCompletionFlow";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  savePostAuthContext,
  clearPostAuthContext,
} from "@/lib/post-auth";
import { runPostAuthPipeline } from "@/lib/post-auth/pipeline";
import { trackAuthCompleted, applyPostAuthCompletionOutcome } from "@/lib/post-auth/resolver";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";

const MY_PLAN_RETURN = "/me/plan";

export type MyPlanUnauthSurface = "auth" | "completion";

export type MyPlanUnauthPhase = "auth" | "completion";

export interface MyPlanUnauthFlowProps {
  open: boolean;
  onRequestClose: () => void;
  nextHref: string;
  onAuthSuccess?: () => void;
  onBeforeClose?: (ctx: { surface: MyPlanUnauthSurface }) => void;
  onPostAuthCompletionPhase?: (active: boolean) => void;
}

/**
 * Единый unauth «Мой план»: AuthForm → post-auth pipeline → ProfileCompletionFlow при необходимости.
 * Один shell (ResponsiveOverlay), без отдельного onboarding.
 */
export function MyPlanUnauthFlow({
  open,
  onRequestClose,
  nextHref,
  onAuthSuccess,
  onBeforeClose,
  onPostAuthCompletionPhase,
}: MyPlanUnauthFlowProps) {
  const router = useRouter();
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const [phase, setPhase] = useState<MyPlanUnauthPhase>(() => "auth");

  useEffect(() => {
    onPostAuthCompletionPhase?.(phase === "completion");
  }, [phase, onPostAuthCompletionPhase]);

  useEffect(() => {
    if (open) {
      savePostAuthContext({
        source: "my_plan",
        pendingAction: null,
        returnTo: MY_PLAN_RETURN,
      });
    }
  }, [open]);

  const requestClose = () => {
    onBeforeClose?.({ surface: phase === "completion" ? "completion" : "auth" });
    onRequestClose();
  };

  const handleCredentialsAuthSuccess = useCallback(async () => {
    trackAuthCompleted("my_plan");
    const result = await runPostAuthPipeline({
      defaultSource: "my_plan",
      isMobile,
      router,
      skipNavigation: false,
    });
    if (result.kind === "completion") {
      setPhase("completion");
      return;
    }
    onAuthSuccess?.();
  }, [isMobile, onAuthSuccess, router]);

  const handleCompletionFinished = useCallback(
    (_opts?: { alreadyComplete?: boolean }) => {
      trackPostAuthEvent("completion_finished", { source: "my_plan" });
      clearPostAuthContext();
      // Всегда ведём на /me/plan (в т.ч. если профиль оказался уже complete при mount).
      applyPostAuthCompletionOutcome("my_plan", {
        isMobile,
        router,
        returnTo: MY_PLAN_RETURN,
        toast,
        skipNavigation: false,
      });
      onAuthSuccess?.();
    },
    [isMobile, onAuthSuccess, router],
  );

  return (
    <div
      className={myPlanUnauthFlowRootClassName(
        cn("animate-in fade-in-0 duration-200"),
      )}
    >
      {phase === "auth" ? (
        <MyPlanFlowShell
          title=""
          authHeroHeader={{
            eyebrow: "Мой план",
            title: "Соберём ваш персональный план",
            subtitle:
              "Подберём активности под возраст ребёнка, интересы и формат отдыха",
          }}
          onClose={requestClose}
          bodyClassName="min-h-0 overflow-y-auto px-1"
        >
          <div className="mx-auto flex w-full max-w-[400px] flex-col gap-4 sm:gap-5">
            <MyPlanDayTimelinePreview />
            <AuthForm
              open={open}
              onRequestClose={requestClose}
              nextHref={nextHref}
              postAuthSource="my_plan"
              title="Вход или регистрация"
              subtitle="Сохраняйте активности в план и в идеи"
              onAuthSuccess={handleCredentialsAuthSuccess}
              deferNavigation
              hideCloseButton
            />
          </div>
        </MyPlanFlowShell>
      ) : (
        <MyPlanFlowShell
          title="Профиль"
          subtitle="Несколько шагов — для персональных подборок"
          onClose={requestClose}
          showBack
          onBack={() => setPhase("auth")}
          bodyClassName="min-h-0 overflow-y-auto"
        >
          <ProfileCompletionFlow
            entryPoint="my_plan"
            returnTo={MY_PLAN_RETURN}
            onFinished={handleCompletionFinished}
          />
        </MyPlanFlowShell>
      )}
    </div>
  );
}
