"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AuthTabs } from "./AuthTabs";
import { PhoneAuthForm } from "./PhoneAuthForm";
import { EmailAuthForm } from "./EmailAuthForm";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";

export type AuthMode = "login" | "register";

export function AuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialMode = (searchParams.get("mode") === "register" ? "register" : "login") as AuthMode;
  const next = searchParams.get("next") ?? getPostAuthRedirect();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [registerPhoneVerified, setRegisterPhoneVerified] = useState(false);
  const sharedRawPhone = useRef("");

  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const switchMode = useCallback((m: AuthMode) => {
    setMode(m);
  }, []);

  return (
    <div className="relative min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-8">
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Назад
      </button>

      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">
            {mode === "login" ? "Вход в mamaGo" : "Создание аккаунта"}
          </h1>
          <p className="text-sm text-neutral-500">Планируйте лучшее время с детьми</p>
        </div>

        <AuthTabs mode={mode} onChange={switchMode} />

        <div
          className={cn(mode !== "login" && "hidden")}
          aria-hidden={mode !== "login"}
        >
          <PhoneAuthForm
            mode="login"
            next={next}
            autoFocus={false}
            initialPhone={sharedRawPhone.current}
            onPhoneChange={(raw) => {
              sharedRawPhone.current = raw;
            }}
            onSwitchMode={() => switchMode("register")}
          />
        </div>
        <div
          className={cn(mode !== "register" && "hidden")}
          aria-hidden={mode !== "register"}
        >
          <PhoneAuthForm
            mode="register"
            next={next}
            autoFocus={false}
            initialPhone={sharedRawPhone.current}
            onPhoneChange={(raw) => {
              sharedRawPhone.current = raw;
            }}
            onSwitchMode={() => switchMode("login")}
            onRegisterPhoneVerified={() => setRegisterPhoneVerified(true)}
          />
        </div>

        {mode === "register" && registerPhoneVerified && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Номер подтверждён. Теперь завершите создание аккаунта.
          </div>
        )}

        {/* Divider — login only */}
        {mode === "login" && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="text-xs text-neutral-400">или</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>
        )}

        <EmailAuthForm
          mode={mode}
          next={next}
          registerPhoneVerified={mode === "register" ? registerPhoneVerified : true}
        />

        {/* Legal text — register only */}
        {mode === "register" && registerPhoneVerified && (
          <p className="text-xs text-neutral-400 text-center leading-relaxed">
            Продолжая, вы соглашаетесь с{" "}
            <a href="/terms" className="underline hover:text-neutral-600">условиями использования</a>
            {" "}и{" "}
            <a href="/privacy" className="underline hover:text-neutral-600">политикой конфиденциальности</a>
          </p>
        )}
      </div>
    </div>
  );
}
