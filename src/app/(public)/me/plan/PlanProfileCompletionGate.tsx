"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileCompletionFlow } from "@/components/post-auth/ProfileCompletionFlow";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { savePostAuthContext, clearPostAuthContext } from "@/lib/post-auth";
import { applyPostAuthCompletionOutcome } from "@/lib/post-auth/resolver";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";
import { useAuthMe } from "@/lib/auth/useAuthMe";

/**
 * Safety net: пользователь на /me/plan с сессией, но без usable-профиля — дозаполнение в одном modal.
 *
 * Проверка профиля происходит по данным из AuthProvider (SSR), без лишнего API-запроса.
 */
export function PlanProfileCompletionGate() {
  const router = useRouter();
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const [dismissed, setDismissed] = useState(false);
  const { user, status } = useAuthMe();
  const open =
    !dismissed &&
    status === "authenticated" &&
    Boolean(user) &&
    !Boolean(user?.displayName?.trim());

  useEffect(() => {
    if (!open) return;

    savePostAuthContext({
      source: "my_plan",
      pendingAction: null,
      returnTo: "/me/plan",
    });
    trackPostAuthEvent("completion_started", { source: "my_plan" });
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[min(90vh,680px)] overflow-y-auto sm:max-w-md"
        showCloseButton={false}
        dismissible={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Заполните профиль</DialogTitle>
        </DialogHeader>
        <ProfileCompletionFlow
          entryPoint="my_plan"
          returnTo="/me/plan"
          onFinished={(opts) => {
            trackPostAuthEvent("completion_finished", { source: "my_plan" });
            clearPostAuthContext();
            if (opts?.alreadyComplete !== true) {
              applyPostAuthCompletionOutcome("my_plan", {
                isMobile,
                router,
                returnTo: "/me/plan",
                toast,
                skipNavigation: false,
              });
            }
            setDismissed(true);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
