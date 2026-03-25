"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";

interface Props {
  mode: "login" | "register";
  next?: string;
  /** Регистрация по телефону: показывать форму только после SMS. */
  registerPhoneVerified?: boolean;
  /** Текст кнопки в режиме регистрации (по умолчанию «Создать аккаунт»). */
  registerSubmitLabel?: string;
}

const inputClass =
  "w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400";

function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const MIN_PASSWORD_LEN = 8;

export function EmailLoginForm({
  mode,
  next,
  registerPhoneVerified = false,
  registerSubmitLabel = "Создать аккаунт",
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailOk = isValidEmail(email);
  const passwordOk = password.length >= MIN_PASSWORD_LEN;
  const confirmNonEmpty = confirm.length > 0;
  const passwordsMatch = password === confirm && confirmNonEmpty;

  const passwordHint = useMemo(() => {
    if (mode !== "register" || !confirmNonEmpty) return null;
    if (!passwordsMatch) {
      return <p className="text-sm text-red-500">Пароли не совпадают</p>;
    }
    return <p className="text-sm text-emerald-600">Пароли совпадают</p>;
  }, [mode, confirmNonEmpty, passwordsMatch]);

  const canSubmitLogin = mode === "login" && email.trim().length > 0 && password.length > 0 && !loading;

  const canSubmitRegister =
    mode === "register" &&
    registerPhoneVerified &&
    emailOk &&
    passwordOk &&
    confirmNonEmpty &&
    passwordsMatch &&
    !loading;

  const canSubmit = mode === "login" ? canSubmitLogin : canSubmitRegister;

  if (mode === "register" && !registerPhoneVerified) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (!registerPhoneVerified || !emailOk || !passwordOk || !passwordsMatch) return;
    } else if (!email.trim() || !password) {
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Что-то пошло не так");
          return;
        }
        const raw = next ?? getPostAuthRedirect();
        const target = appendBirthdayBuilderAuthParam(raw);
        router.replace(target);
        router.refresh();
        return;
      }

      const res = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось создать аккаунт");
        return;
      }
      const raw = next ?? getPostAuthRedirect();
      const target = appendBirthdayBuilderAuthParam(raw);
      router.replace(target);
      router.refresh();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required={mode === "login"}
        autoComplete="email"
        className={inputClass}
      />
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          required={mode === "login"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#EF8759]/50"
          aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {mode === "register" && (
        <>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Повторите пароль"
              autoComplete="new-password"
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#EF8759]/50"
              aria-label={showConfirm ? "Скрыть пароль" : "Показать пароль"}
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {passwordHint}
        </>
      )}
      {mode === "login" && (
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Забыли пароль?
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading
          ? "Загрузка..."
          : mode === "login"
            ? "Войти"
            : registerSubmitLabel}
      </button>
    </form>
  );
}
