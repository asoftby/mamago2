"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { PageCloseButton } from "@/components/ui/page-close-button";

type Mode = "login" | "register";

interface Props {
  showResetSuccess?: boolean;
  next?: string;
  initialMode?: Mode;
}

export function LoginPageClient({ showResetSuccess, next, initialMode = "login" }: Props) {
  return (
    <div className="relative min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-8">
      <PageCloseButton href="/" />
      <AuthForm
        open
        onRequestClose={() => {}}
        nextHref={next ?? "/me"}
        title="Вход в mamaGo"
        subtitle="Планируйте лучшее время с детьми"
        hideCloseButton
        initialMode={initialMode}
        notice={
          showResetSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
              Пароль успешно изменён. Войдите с новым паролем.
            </div>
          ) : null
        }
      />
    </div>
  );
}
