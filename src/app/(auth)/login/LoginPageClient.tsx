"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { EmailLoginForm } from "./EmailLoginForm";
import { PhoneLoginForm } from "./PhoneLoginForm";

type Mode = "login" | "register";

interface Props {
  showResetSuccess?: boolean;
  next?: string;
  initialMode?: Mode;
}

export function LoginPageClient({ showResetSuccess, next, initialMode = "login" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [registerPhoneVerified, setRegisterPhoneVerified] = useState(false);

  // Подставляется в initialPhone при первом монтировании каждой из двух форм (вход / регистрация).
  const sharedRawPhone = useRef("");

  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
  }, []);

  return (
    <div className="relative min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-8">
      <button
        type="button"
        onClick={handleBack}
        className={cn(
          "absolute top-4 left-4 inline-flex items-center justify-center",
          HEADER_CHROME_ICON_BUTTON_CLASS,
        )}
        aria-label="Закрыть и вернуться назад"
      >
        <X className="h-4 w-4" aria-hidden />
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

        {/* Два экземпляра: при переключении табов не размонтируем — сохраняется шаг (телефон / SMS-код). */}
        <div
          className={cn(mode !== "login" && "hidden")}
          aria-hidden={mode !== "login"}
        >
          <PhoneLoginForm
            purpose="LOGIN"
            initialPhone={sharedRawPhone.current}
            next={next}
            autoFocus={false}
            onPhoneChange={(raw: string) => {
              sharedRawPhone.current = raw;
            }}
            onSwitchMode={() => switchMode("register")}
          />
        </div>
        <div
          className={cn(mode !== "register" && "hidden")}
          aria-hidden={mode !== "register"}
        >
          <PhoneLoginForm
            purpose="REGISTER"
            initialPhone={sharedRawPhone.current}
            next={next}
            autoFocus={false}
            onPhoneChange={(raw: string) => {
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

        {/* Divider — only in login mode */}
        {mode === "login" && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="text-xs text-neutral-400">или</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>
        )}

        {/* Email auth (регистрация: блок только после SMS) */}
        <EmailLoginForm
          mode={mode}
          next={next}
          registerPhoneVerified={mode === "register" ? registerPhoneVerified : true}
        />

        {/* Legal text — register, после подтверждения телефона */}
        {mode === "register" && registerPhoneVerified && (
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
