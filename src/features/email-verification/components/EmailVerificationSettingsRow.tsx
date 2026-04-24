"use client";

import { Mail } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { useResendVerificationEmail } from "../hooks/useResendVerificationEmail";
import { cn } from "@/lib/utils";

export function EmailVerificationSettingsRow() {
  const { user, isLoading, isEmailVerified, refetch } = useAuthMe();
  const { resend, loading, messages } = useResendVerificationEmail();

  if (isLoading || !user) {
    return (
      <div className="px-5 py-4 flex items-center gap-4 animate-pulse">
        <div className="h-9 w-9 rounded-xl bg-neutral-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-neutral-100 rounded" />
          <div className="h-3 w-48 bg-neutral-50 rounded" />
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-neutral-100">
        <Mail className="h-4 w-4 text-neutral-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900">Email</p>
        <p className="text-xs text-neutral-500 mt-0.5 truncate">{user.email}</p>
        <p
          className={cn(
            "text-xs mt-1.5 font-medium",
            isEmailVerified ? "text-emerald-700" : "text-neutral-600",
          )}
        >
          {isEmailVerified ? "Email подтверждён" : "Email не подтверждён"}
        </p>
      </div>
      {!isEmailVerified ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleResend()}
          className="shrink-0 text-sm font-medium text-[#EF8759] hover:text-[#e07848] disabled:opacity-50 transition"
        >
          {loading ? "Отправляем…" : "Отправить письмо"}
        </button>
      ) : null}
    </div>
  );
}
