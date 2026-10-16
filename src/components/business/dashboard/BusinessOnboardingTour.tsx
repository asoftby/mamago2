"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const STEPS = [
  {
    anchor: "intro",
    title: "Это ваш бизнес-кабинет",
    description: "Здесь вы начнёте работу с mamaGo. Подсказки можно пропустить и вернуться к ним позже.",
  },
  {
    anchor: "create",
    title: "Создавайте публикации",
    description: "Место — для вашей площадки, событие — для мероприятий, предложение — для услуг, занятий и лагерей.",
  },
  {
    anchor: "benefits",
    title: "Следите за результатами",
    description: "После публикации появятся просмотры, сохранения и обращения. Доступность показателей зависит от типа публикации.",
  },
] as const;

type TourAction = "tour_complete" | "tour_skip";

export async function sendBusinessOnboardingAction(action: "start" | "public_open" | TourAction) {
  try {
    const result = await fetch("/api/business/onboarding-progress", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      keepalive: action === "public_open",
    });
    return result.ok;
  } catch {
    return false;
  }
}

/** Non-blocking contextual tour. Never intercepts the underlying editor flow. */
export function BusinessOnboardingTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const nextButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-business-tour="${STEPS[index].anchor}"]`),
    ).find((element) => element.getClientRects().length > 0);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    target?.classList.add("outline", "outline-2", "outline-offset-4", "outline-primary");
    nextButton.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void finish("tour_skip");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      target?.classList.remove("outline", "outline-2", "outline-offset-4", "outline-primary");
    };
    // We intentionally track the step rather than the finish callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  function finish(action: TourAction) {
    void sendBusinessOnboardingAction(action);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Знакомство с бизнес-кабинетом mamaGo"
      aria-modal="false"
      className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-[440px] rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:bottom-7 sm:left-auto sm:right-7"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Знакомство с кабинетом · {index + 1} из {STEPS.length}
        </p>
        <button type="button" aria-label="Закрыть знакомство" onClick={() => finish("tour_skip")} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-stone-950">{STEPS[index].title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{STEPS[index].description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => finish("tour_skip")} className="text-sm text-stone-500 hover:text-stone-950">
          Пропустить
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button type="button" onClick={() => setIndex((value) => value - 1)} className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
              <ArrowLeft className="h-4 w-4" /> Назад
            </button>
          )}
          <button ref={nextButton} type="button" onClick={() => index < STEPS.length - 1 ? setIndex((value) => value + 1) : finish("tour_complete")} className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            {index === STEPS.length - 1 ? "Завершить" : "Далее"}
            {index < STEPS.length - 1 && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
