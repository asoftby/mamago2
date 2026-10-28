"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function JournalNewsOverlay({ children, fallbackHref }: { children: React.ReactNode; fallbackHref: string }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") router.back(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [router]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Публикация Breaking News" className="fixed inset-0 z-[100] bg-black/60 md:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) router.back(); }}>
      <div ref={panel} tabIndex={-1} className="relative mx-auto h-full w-full max-w-5xl overflow-y-auto overscroll-contain rounded-none bg-white shadow-2xl md:rounded-3xl">
        <button type="button" aria-label="Закрыть публикацию" onClick={() => router.back()} className="fixed right-5 top-[max(1rem,env(safe-area-inset-top))] z-[120] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg md:right-[max(2rem,calc((100vw-64rem)/2))]"><X aria-hidden size={22}/></button>
        {children}
      </div>
    </div>
  );
}
