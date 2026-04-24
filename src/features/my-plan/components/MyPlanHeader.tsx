"use client";

import { ModalCloseButton } from "@/components/ui/modal-close-button";

type MyPlanHeaderProps = {
  onClose?: () => void;
  compact?: boolean;
};

export function MyPlanHeader({ onClose, compact = false }: MyPlanHeaderProps) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pr-2">
          <h2
            className={
              compact
                ? "text-xl font-semibold tracking-tight text-neutral-900"
                : "text-[28px] font-semibold tracking-tight text-neutral-900"
            }
          >
            Мой план
          </h2>
          <p
            className={
              compact
                ? "mt-1 text-sm leading-snug text-neutral-500"
                : "mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500"
            }
          >
            Выберите день и участников — mamaGo быстро подберет идеи или поможет собрать день вручную.
          </p>
        </div>
        <ModalCloseButton
          type="button"
          onClick={() => onClose?.()}
          className="shrink-0"
          aria-label="Закрыть мой план"
        />
      </div>
    </div>
  );
}
