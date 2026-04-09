"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileCompletionFlow } from "@/components/post-auth/ProfileCompletionFlow";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { savePostAuthContext, clearPostAuthContext } from "@/lib/post-auth";
import { applyPostAuthCompletionOutcome } from "@/lib/post-auth/resolver";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";
import type { ProfileStatePayload } from "@/lib/post-auth/types";

/**
 * Safety net: пользователь на /me/plan с сессией, но без usable-профиля — дозаполнение в одном modal.
 */
export function PlanProfileCompletionGate() {
  const router = useRouter();
  const isMobile = !useMediaQuery("(min-width: 640px)");
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/profile-state", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ProfileStatePayload;
        if (cancelled) return;
        if (!data.isProfileComplete) {
          savePostAuthContext({
            source: "my_plan",
            pendingAction: null,
            returnTo: "/me/plan",
          });
          trackPostAuthEvent("completion_started", { source: "my_plan" });
          setOpen(true);
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked || !open) return null;

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
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
