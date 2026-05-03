"use client";

import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";

// Единый слой — сам toast без вложенных контейнеров
const toastBase =
  "group flex w-[min(100vw-1.5rem,400px)] max-w-[min(100vw-1.5rem,400px)] items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.10)]";

export function Sonner() {
  return (
    <Toaster
      position="top-center"
      richColors={false}
      closeButton
      duration={2500}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: toastBase,
          content: "flex min-w-0 flex-1 flex-col !p-0",
          title: "!m-0 !p-0 text-sm font-medium leading-snug text-neutral-900",
          description: "!mt-0.5 text-xs leading-snug text-neutral-500",

          // Иконка — просто иконка, без фонового кружка
          icon: "!mt-0 flex size-5 shrink-0 items-center justify-center self-center",

          // Крестик — лёгкий, без фона
          closeButton:
            "!static !left-auto !right-auto !top-auto !translate-x-0 !translate-y-0 flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-black/5 transition-colors",

          actionButton:
            "ml-1 shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700",
          cancelButton:
            "ml-1 shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50",

          // Состояния — только фон + граница, без градиентов
          success: "bg-emerald-50 border-emerald-200/80",
          error:   "bg-rose-50    border-rose-200/80",
          warning: "bg-amber-50   border-amber-200/80",
          info:    "bg-sky-50     border-sky-200/80",
          loading: "bg-white      border-neutral-200",
          default: "bg-white      border-neutral-200",
        },
      }}
      icons={{
        loading: <Loader2 className="size-4 animate-spin text-neutral-500" aria-hidden />,
      }}
    />
  );
}
