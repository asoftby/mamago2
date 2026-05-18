"use client";

import { CalendarDays, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type AddToPlanAfterExternalActionPromptProps = {
  open: boolean;
  onAddToPlan: () => void;
  onDismiss: () => void;
  isIdea?: boolean;
};

function PromptBody({
  onAddToPlan,
  onDismiss,
  isIdea = false,
}: Omit<AddToPlanAfterExternalActionPromptProps, "open">) {
  const title = isIdea ? "Добавить в план?" : "Не потерять событие?";
  const description = isIdea
    ? "Вы уже сохранили событие в идеи. Добавьте его на дату, чтобы не забыть."
    : "Добавьте его в «Мой план», чтобы дата, время и напоминание были под рукой.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFE8DC] text-[#EF8759]">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[18px] font-semibold leading-tight text-[#141210]">
            {title}
          </h3>
          <p className="mt-1.5 text-[14px] leading-6 text-[rgba(20,18,16,0.68)]">
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={onAddToPlan}
          className="h-12 flex-1 rounded-full bg-[#EF8759] text-[15px] font-semibold text-white hover:bg-[#e07848]"
        >
          Добавить в план
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDismiss}
          className="h-12 rounded-full border-[rgba(20,18,16,0.14)] px-5 text-[15px] font-semibold text-[#141210]"
        >
          Не сейчас
        </Button>
      </div>
    </div>
  );
}

export function AddToPlanAfterExternalActionPrompt({
  open,
  onAddToPlan,
  onDismiss,
  isIdea = false,
}: AddToPlanAfterExternalActionPromptProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (!open) return null;

  if (!isDesktop) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onDismiss();
        }}
        title="Добавить в план"
        hideTitle
        showCloseButton={false}
        height="auto"
        className="rounded-t-[24px]"
        headerClassName="border-b-0 bg-white px-4 pt-3 pb-0"
        headerContent={<div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-200" />}
      >
        <div className="px-4 pb-5 pt-4">
          <PromptBody onAddToPlan={onAddToPlan} onDismiss={onDismiss} isIdea={isIdea} />
        </div>
      </BottomSheet>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[65] w-[min(420px,calc(100vw-2rem))]">
      <div className="relative rounded-[24px] border border-[rgba(20,18,16,0.10)] bg-white p-5 shadow-[0_22px_60px_rgba(20,18,16,0.18)]">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрыть подсказку"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[rgba(20,18,16,0.45)] transition-colors hover:bg-[rgba(20,18,16,0.06)] hover:text-[#141210]"
        >
          <X className="h-4 w-4" />
        </button>
        <PromptBody onAddToPlan={onAddToPlan} onDismiss={onDismiss} isIdea={isIdea} />
      </div>
    </div>
  );
}
