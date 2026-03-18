"use client";

import { cn } from "@/lib/utils";
import type { AuthMode } from "./AuthPage";

interface AuthTabsProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export function AuthTabs({ mode, onChange }: AuthTabsProps) {
  return (
    <div className="flex bg-neutral-100 rounded-full p-1 gap-1">
      {(["login", "register"] as AuthMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
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
  );
}
