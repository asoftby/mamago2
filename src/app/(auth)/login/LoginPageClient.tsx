"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { PageCloseButton } from "@/components/ui/page-close-button";
import { getSafeRedirectPath } from "@/lib/auth/redirectTo";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";

type Mode = "login" | "register";

interface Props {
  showResetSuccess?: boolean;
  redirectTo?: string;
  initialMode?: Mode;
  initialEmail?: string;
  inviteKind?: string;
  invitationToken?: string;
}

export function LoginPageClient({
  showResetSuccess,
  redirectTo,
  initialMode = "login",
  initialEmail = "",
  inviteKind,
  invitationToken,
}: Props) {
  const safeRedirectTo = getSafeRedirectPath(redirectTo, getPostAuthRedirect());

  const inviteNotice =
    inviteKind === "business-team" ? (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
        Войдите или завершите регистрацию с адресом из приглашения. После этого мы автоматически
        добавим вас в команду бизнеса.
      </div>
    ) : null;

  return (
    <div className="relative min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-8">
      <PageCloseButton href="/" />
      <AuthForm
        open
        onRequestClose={() => {}}
        nextHref={safeRedirectTo}
        title="Вход в mamaGo"
        subtitle="Планируйте лучшее время с детьми"
        hideCloseButton
        initialMode={initialMode}
        initialEmail={initialEmail}
        emailReadOnly={inviteKind === "business-team"}
        invitationToken={invitationToken}
        notice={
          showResetSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
              Пароль успешно изменён. Войдите с новым паролем.
            </div>
          ) : inviteNotice
        }
      />
    </div>
  );
}
