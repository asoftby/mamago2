"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export function LoginForm({ from, next }: { from?: string; next?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          setError(data.error || "Неверный email или пароль");
        } else {
          setError("Произошла ошибка. Попробуйте ещё раз.");
        }
        setIsLoading(false);
        return;
      }

      // Success - determine redirect target
      let targetPath = "/minsk"; // default

      // Priority 1: from parameter
      if (from) {
        if (from === "admin") {
          targetPath = "/admin";
        } else if (from === "business") {
          targetPath = "/business";
        } else if (from === "public") {
          targetPath = "/minsk";
        } else {
          targetPath = from; // use as-is if it's a path
        }
      } 
      // Priority 2: next parameter
      else if (next) {
        targetPath = next;
      }
      // Priority 3: detect from host
      else {
        const host = window.location.host;
        if (host.startsWith("admin.")) {
          targetPath = "/admin";
        } else if (host.startsWith("business.")) {
          targetPath = "/business";
        }
      }

      // Redirect
      router.replace(targetPath);
    } catch (err) {
      console.error("Login error:", err);
      setError("Не удалось подключиться к серверу");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          disabled={isLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="your@email.com"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-sm text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Пароль
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={isLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Введите пароль"
        />
        {fieldErrors.password && (
          <p className="mt-1 text-sm text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <PrimaryButton
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? "Вход..." : "Войти"}
      </PrimaryButton>
    </form>
  );
}
