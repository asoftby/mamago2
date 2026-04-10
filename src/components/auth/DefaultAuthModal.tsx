"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AuthForm } from "./AuthForm";
import { ProfileCompletionFlow } from "@/components/post-auth/ProfileCompletionFlow";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  savePostAuthContext,
  clearPostAuthContext,
  type AuthEntryPoint,
} from "@/lib/post-auth";
import { runPostAuthPipeline } from "@/lib/post-auth/pipeline";
import { trackAuthCompleted, applyPostAuthCompletionOutcome } from "@/lib/post-auth/resolver";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { navigateToSurface } from "@/lib/routing/clientNavigation";

export type AuthModalPhase = "auth" | "completion";

export interface DefaultAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;
  subtitle: string;
  dialogTitle?: string;
  onAuthSuccess?: () => void;
  authEntryPoint?: AuthEntryPoint;
  /** @deprecated не используется */
  isMobile?: boolean;
  /** @deprecated онбординг убран; оставлено для совместимости API */
  withOnboarding?: boolean;
}

export function DefaultAuthModal({
  open,
  onOpenChange,
  nextHref,
  title,
  subtitle,
  dialogTitle = "Вход или регистрация",
  onAuthSuccess,
  authEntryPoint = "profile",
}: DefaultAuthModalProps) {
  const router = useRouter();
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const [phase, setPhase] = useState<AuthModalPhase>("auth");

  useEffect(() => {
    if (!open) {
      setPhase("auth");
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      savePostAuthContext({
        source: authEntryPoint,
        pendingAction: null,
        returnTo: nextHref || getPostAuthRedirect(),
      });
    }
  }, [open, authEntryPoint, nextHref]);

  const handleCredentialsAuthSuccess = useCallback(async () => {
    trackAuthCompleted(authEntryPoint);
    const result = await runPostAuthPipeline({
      defaultSource: authEntryPoint,
      isMobile,
      router,
    });
    if (result.kind === "completion") {
      setPhase("completion");
      return;
    }
    clearPostAuthContext();
    onAuthSuccess?.();
    onOpenChange(false);
  }, [authEntryPoint, isMobile, router, onAuthSuccess, onOpenChange]);

  const handleCompletionFinished = useCallback(
    (opts?: { alreadyComplete?: boolean }) => {
      trackPostAuthEvent("completion_finished", { source: authEntryPoint });
      clearPostAuthContext();
      if (opts?.alreadyComplete !== true) {
        applyPostAuthCompletionOutcome(authEntryPoint, {
          isMobile,
          router,
          returnTo: nextHref,
          toast,
        });
      } else if (authEntryPoint === "profile") {
        // Профиль уже был готов при открытии completion — иначе редирект не вызывался
        navigateToSurface(router, {
          targetSurface: "public",
          targetPath: "/me",
        });
      }
      onAuthSuccess?.();
      onOpenChange(false);
    },
    [authEntryPoint, isMobile, nextHref, onAuthSuccess, onOpenChange, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dismissible={false}
        showCloseButton={false}
        className={cn(
          "max-h-[min(90vh,680px)] overflow-y-auto overflow-x-visible gap-0 border-0 bg-transparent shadow-none",
          "px-5 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6",
          "sm:max-w-[420px]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {phase === "auth" ? (
          <AuthForm
            open={open}
            onRequestClose={() => onOpenChange(false)}
            nextHref={nextHref}
            postAuthSource={authEntryPoint}
            title={title}
            subtitle={subtitle}
            onAuthSuccess={handleCredentialsAuthSuccess}
            deferNavigation
          />
        ) : (
          <div className="relative mx-auto w-full max-w-[400px] rounded-2xl border border-neutral-200/80 bg-white p-2 shadow-md">
            <ProfileCompletionFlow
              entryPoint={authEntryPoint}
              returnTo={nextHref}
              onFinished={handleCompletionFinished}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
