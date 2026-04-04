"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { EmailLoginForm } from "@/app/(auth)/login/EmailLoginForm";
import { PhoneLoginForm } from "@/app/(auth)/login/PhoneLoginForm";

type Mode = "login" | "register";

export interface SiteAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;
  subtitle: string;
  /** Краткий заголовок для `DialogTitle` (скринридеры). */
  dialogTitle?: string;
  /** Вызывается после успешной авторизации (login/register). */
  onAuthSuccess?: () => void;
}

export function SiteAuthModal({
  open,
  onOpenChange,
  nextHref,
  title,
  subtitle,
  dialogTitle = "Вход или регистрация",
  onAuthSuccess,
}: SiteAuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [registerPhoneVerified, setRegisterPhoneVerified] = useState(false);
  const sharedRawPhone = useRef("");

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
  }, []);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setRegisterPhoneVerified(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[min(90vh,720px)] overflow-y-auto overflow-x-visible gap-0 border-0 bg-transparent shadow-none",
          "px-5 pb-6 pt-10 sm:px-8 sm:pb-8 sm:pt-12",
          "sm:max-w-[440px]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="relative w-full">
            <ModalCloseButton
              onClick={() => onOpenChange(false)}
              className="absolute -right-[15px] -top-[15px] z-20 shadow-md"
            />

            <div className="w-full rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-md sm:p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
              <p className="text-sm text-neutral-500">{subtitle}</p>
            </div>

            <div className="flex bg-neutral-100 rounded-full p-1 gap-1">
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200",
                    mode === m
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  {m === "login" ? "Войти" : "Создать профиль"}
                </button>
              ))}
            </div>

            <div className={cn(mode !== "login" && "hidden")} aria-hidden={mode !== "login"}>
              <PhoneLoginForm
                purpose="LOGIN"
                initialPhone={sharedRawPhone.current}
                next={nextHref}
                autoFocus={false}
                onPhoneChange={(raw: string) => {
                  sharedRawPhone.current = raw;
                }}
                onSwitchMode={() => switchMode("register")}
                onSuccess={onAuthSuccess}
              />
            </div>
            <div className={cn(mode !== "register" && "hidden")} aria-hidden={mode !== "register"}>
              <PhoneLoginForm
                purpose="REGISTER"
                initialPhone={sharedRawPhone.current}
                next={nextHref}
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
                Номер подтверждён. Теперь завершите создание профиля.
              </div>
            )}

            {mode === "login" && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">или</span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>
            )}

            <EmailLoginForm
              mode={mode}
              next={nextHref}
              registerPhoneVerified={mode === "register" ? registerPhoneVerified : true}
              registerSubmitLabel="Создать профиль"
              onSuccess={onAuthSuccess}
            />

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
