"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function JournalNewsOverlay({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        router.back();
      }
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Публикация Breaking News"
      className="journal-news-backdrop fixed inset-0 z-[100] bg-black/60 md:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) router.back(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="journal-news-panel relative mx-auto h-full w-full max-w-5xl overflow-y-auto overscroll-contain rounded-none bg-white shadow-2xl md:rounded-3xl"
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Закрыть публикацию"
          onClick={() => router.back()}
          className="fixed right-5 top-[max(1rem,env(safe-area-inset-top))] z-[120] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:right-[max(2rem,calc((100vw-64rem)/2))]"
        >
          <X aria-hidden size={22} />
        </button>
        {children}
      </div>
      <style jsx>{`
        .journal-news-backdrop { animation: journal-backdrop-in 220ms ease-out both; }
        .journal-news-panel { animation: journal-panel-in 340ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes journal-backdrop-in { from { background-color: transparent; } }
        @keyframes journal-panel-in {
          from { opacity: .65; transform: translateY(28px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .journal-news-backdrop, .journal-news-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}
