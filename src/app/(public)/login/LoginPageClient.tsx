"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailLoginForm } from "./EmailLoginForm";
import { PhoneLoginForm } from "./PhoneLoginForm";

type Mode = "login" | "register";

interface Props {
  showResetSuccess?: boolean;
  from?: string;
  next?: string;
  initialMode?: Mode;
}

export function LoginPageClient({ showResetSuccess, next, initialMode = "login" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  // Shared raw phone digits — only the number transfers between tabs, not OTP state.
  // Updated whenever PhoneLoginForm reports a phone change.
  const sharedRawPhone = useRef("");

  // Track which tab was just activated so PhoneInput knows to auto-focus
  const [focusKey, setFocusKey] = useState(0);

  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    // Increment focusKey so the new tab's PhoneInput auto-focuses
    setFocusKey((k) => k + 1);
  }, []);

  return (
    <div className="relative min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      {/* Back */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Назад
      </button>

      {/* Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">
            {mode === "login" ? "Вход в mamaGo" : "Создание аккаунта"}
          </h1>
          <p className="text-sm text-neutral-500">Планируйте лучшее время с детьми</p>
        </div>

        {/* Reset success banner */}
        {showResetSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            ✓ Пароль успешно изменён. Войдите с новым паролем.
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex bg-neutral-100 rounded-full p-1 gap-1">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200",
                mode === m
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              {m === "login" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>

        {/*
          key={mode} — React fully remounts PhoneLoginForm on tab switch.
          This is the architecture-level isolation: each tab gets its own
          component instance with completely fresh state.
          No OTP state, no error state, no loading state leaks between tabs.

          focusKey is passed as autoFocus trigger — increments on every tab switch
          so the phone input focuses when the user arrives on a tab.

          initialPhone passes the last known raw digits for convenience prefill.
        */}
        <PhoneLoginForm
          key={mode}
          purpose={mode === "login" ? "LOGIN" : "REGISTER"}
          initialPhone={sharedRawPhone.current}
          next={next}
          autoFocus={focusKey > 0}
          onPhoneChange={(raw: string) => { sharedRawPhone.current = raw; }}
          onSwitchMode={() => switchMode(mode === "login" ? "register" : "login")}
        />

        {/* Divider — only in login mode */}
        {mode === "login" && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="text-xs text-neutral-400">или</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>
        )}

        {/* Email auth */}
        <EmailLoginForm mode={mode} next={next} />

        {/* Legal text — only in register mode */}
        {mode === "register" && (
          <p className="text-xs text-neutral-400 text-center leading-relaxed">
            Продолжая, вы соглашаетесь с{" "}
            <a href="/terms" className="underline hover:text-neutral-600">
              условиями использования
            </a>{" "}
            и{" "}
            <a href="/privacy" className="underline hover:text-neutral-600">
              политикой конфиденциальности
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
