"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "beta-tip-dismissed";

export function BetaTip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Mobile: above bottom nav */}
      <div
        className="lg:hidden fixed z-50 left-3 right-3 pointer-events-none"
        style={{ bottom: "calc(max(0.5rem, env(safe-area-inset-bottom)) + 4.25rem)" }}
      >
        <div
          className={[
            "flex items-center gap-2 rounded-[20px] px-4 py-2.5 pointer-events-auto",
            "border border-white/60",
            "bg-white/35 backdrop-blur-2xl backdrop-saturate-150",
            "shadow-[0_2px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]",
            "text-neutral-800",
          ].join(" ")}
        >
          <div className="flex-1 text-[13px] leading-snug">
            Это beta версия. Что-то сломалось?{" "}
            <a
              href="https://t.me/shapovalovalexey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 decoration-neutral-500/60"
            >
              Напишите сюда
            </a>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-black/8 text-neutral-500 hover:bg-black/14 hover:text-neutral-700 transition-colors"
            aria-label="Закрыть"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Desktop: bottom-left, same row & height as MyPlanWidget */}
      <div className="hidden lg:block fixed z-50 left-4 bottom-4 w-[min(100vw-2rem,280px)] animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
        <div
          className={[
            "flex items-center gap-2 rounded-full px-4 py-3.5 pointer-events-auto",
            "border border-white/60",
            "bg-white/35 backdrop-blur-2xl backdrop-saturate-150",
            "shadow-[0_16px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]",
            "text-neutral-800",
          ].join(" ")}
        >
          <div className="flex-1 text-[13px] leading-snug">
            Это beta версия. Что-то сломалось?{" "}
            <a
              href="https://t.me/shapovalovalexey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 decoration-neutral-500/60"
            >
              Напишите сюда
            </a>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-black/8 text-neutral-500 hover:bg-black/14 hover:text-neutral-700 transition-colors"
            aria-label="Закрыть"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  );
}
