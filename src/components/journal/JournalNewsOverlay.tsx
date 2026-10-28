"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { BreakingNewsLazyNext } from "./BreakingNewsLazyNext";

export function JournalNewsOverlay({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const originRef = useRef<DOMRect | null>(null);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = dialogRef.current;
    const origin = originRef.current;
    if (!panel || !origin || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.back();
      return;
    }
    const target = panel.getBoundingClientRect();
    const x = origin.left + origin.width / 2 - (target.left + target.width / 2);
    const y = origin.top + origin.height / 2 - (target.top + target.height / 2);
    const animation = panel.animate([
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${x}px, ${y}px) scale(${Math.max(.08, origin.width / target.width)}, ${Math.max(.08, origin.height / target.height)})`, opacity: .65, borderRadius: "18px" },
    ], { duration: 280, easing: "cubic-bezier(.4,0,.8,.2)", fill: "forwards" });
    animation.finished.then(() => router.back()).catch(() => router.back());
  }, [router]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      const stored = sessionStorage.getItem("mamago.journal.news.origin");
      sessionStorage.removeItem("mamago.journal.news.origin");
      const origin = stored ? JSON.parse(stored) as { at: number; path: string; x: number; y: number; width: number; height: number } : null;
      originRef.current = origin && Date.now() - origin.at < 5000 && origin.path === window.location.pathname
        ? new DOMRect(origin.x, origin.y, origin.width, origin.height)
        : null;
    } catch { originRef.current = null; }
    if (originRef.current && dialogRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const origin = originRef.current;
      const target = dialogRef.current.getBoundingClientRect();
      const x = origin.left + origin.width / 2 - (target.left + target.width / 2);
      const y = origin.top + origin.height / 2 - (target.top + target.height / 2);
      dialogRef.current.animate([
        { transform: `translate(${x}px, ${y}px) scale(${Math.max(.08, origin.width / target.width)}, ${Math.max(.08, origin.height / target.height)})`, borderRadius: "18px", opacity: .8 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
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
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Публикация Breaking News"
      className="journal-news-backdrop fixed inset-0 z-[100] bg-black/60 md:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
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
          onClick={close}
          className="fixed right-5 top-[max(1rem,env(safe-area-inset-top))] z-[120] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:right-[max(2rem,calc((100vw-64rem)/2))]"
        >
          <X aria-hidden size={22} />
        </button>
        {children}
        <BreakingNewsLazyNext />
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
