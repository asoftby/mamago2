"use client";

import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";

const liquidShell =
  "group flex w-[min(100vw-1.5rem,420px)] max-w-[min(100vw-1.5rem,420px)] items-center gap-3 rounded-[28px] border border-white/50 bg-white/60 px-4 py-3 shadow-[0_12px_36px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl";

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
          toast: liquidShell,
          content: "flex min-w-0 flex-1 items-center gap-3 !gap-3 !p-0 w-full",
          title: "!m-0 !w-full min-w-0 !p-0 text-sm font-medium leading-snug text-neutral-900",
          description: "!mt-0.5 text-xs leading-snug text-neutral-600",
          icon: "!mt-0 flex size-9 shrink-0 items-center justify-center self-center rounded-full border border-white/45 bg-white/55 text-neutral-700 shadow-sm backdrop-blur",
          closeButton:
            "!static !left-auto !right-auto !top-auto !translate-x-0 !translate-y-0 flex size-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/45 text-neutral-700 shadow-sm backdrop-blur hover:bg-white/70",
          actionButton:
            "ml-1 shrink-0 rounded-full border border-white/55 bg-white/50 px-3 py-1.5 text-xs font-semibold text-neutral-800 backdrop-blur hover:bg-white/75",
          cancelButton:
            "ml-1 shrink-0 rounded-full border border-white/55 bg-white/40 px-3 py-1.5 text-xs font-semibold text-neutral-700 backdrop-blur hover:bg-white/65",
          success:
            "bg-gradient-to-br from-emerald-100/75 via-white/58 to-teal-50/48 data-[type=success]:border-white/50",
          error:
            "bg-gradient-to-br from-rose-100/72 via-white/56 to-orange-50/45 data-[type=error]:border-white/50",
          warning:
            "bg-gradient-to-br from-amber-100/75 via-white/56 to-yellow-50/46 data-[type=warning]:border-white/50",
          info: "bg-gradient-to-br from-sky-100/72 via-white/56 to-slate-50/46 data-[type=info]:border-white/50",
          loading:
            "bg-gradient-to-br from-neutral-100/88 via-white/55 to-neutral-50/48 data-[type=loading]:border-white/50",
          default:
            "bg-gradient-to-br from-[#FFE8DC]/88 via-white/58 to-[#FFF5F0]/50 data-[type=default]:border-white/50",
        },
      }}
      icons={{
        loading: <Loader2 className="size-5 animate-spin text-neutral-600" aria-hidden />,
      }}
    />
  );
}
