"use client";

import { toast } from "@/lib/toast";
import { Mail } from "lucide-react";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { useResendVerificationEmail } from "@/features/email-verification/hooks/useResendVerificationEmail";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function EmailSettingsClient() {
  const { user, isLoading, isEmailVerified, refetch } = useAuthMe();
  const { resend, loading, messages } = useResendVerificationEmail();

  const handleResend = async () => {
    const result = await resend();
    if (!result.ok) {
      if (result.code === "RATE_LIMIT") {
        toast.message(messages.rateLimit);
        return;
      }
      toast.error(messages.error);
      return;
    }

    if (result.alreadyVerified) {
      toast.success("Email уже подтверждён");
      void refetch();
      return;
    }

    toast.success(messages.success);
  };

  if (isLoading || !user) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-neutral-100" />
          <div className="h-4 w-56 rounded bg-neutral-50" />
          <div className="h-11 w-40 rounded bg-neutral-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
          <Mail className="h-4 w-4 text-neutral-500" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900">Email</p>
            <p className="truncate text-sm text-neutral-600">{user.email}</p>
            <p
              className={cn(
                "text-sm font-medium",
                isEmailVerified ? "text-emerald-700" : "text-amber-700",
              )}
            >
              {isEmailVerified ? "Email подтверждён" : "Email не подтверждён"}
            </p>
          </div>

          {!isEmailVerified ? (
            <Button
              type="button"
              onClick={() => void handleResend()}
              disabled={loading}
              className="h-11 rounded-xl px-5"
            >
              {loading ? "Отправляем…" : "Отправить письмо"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
