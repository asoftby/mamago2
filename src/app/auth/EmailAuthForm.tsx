"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AuthMode } from "./AuthPage";

interface EmailAuthFormProps {
  mode: AuthMode;
  next: string;
}

export function EmailAuthForm({ mode, next }: EmailAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Что-то пошло не так");
      } else {
        router.push(next);
        router.refresh();
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className={inputClass}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        required
        className={inputClass}
      />
      {mode === "register" && (
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Повторите пароль"
          required
          className={inputClass}
        />
      )}
      {mode === "login" && (
        <div className="text-right">
          <Link href="/reset-password" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
            Забыли пароль?
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading
          ? "Загрузка..."
          : mode === "login"
          ? "Войти"
          : "Создать аккаунт"}
      </button>
    </form>
  );
}
