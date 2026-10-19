"use client";

import { Plus } from "lucide-react";

/**
 * «Стеклянная» кнопка «Что нужно сделать?» из дизайна «Мой план v3» — общая для виджета
 * и мобильной страницы плана. Позиционирование (парение над списком) задаёт родитель.
 */
export function PlanAddTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto relative isolate flex h-[60px] w-full items-center gap-3 overflow-hidden rounded-[20px] border border-white/90 bg-gradient-to-br from-white/80 to-white/40 pl-[18px] pr-2 text-left text-[16.5px] font-semibold text-[var(--text-main)] shadow-[0_10px_28px_-10px_color-mix(in_srgb,var(--brand)_40%,transparent),0_2px_6px_rgba(26,20,16,.08),inset_0_1px_0_#fff] backdrop-blur-[18px] backdrop-saturate-[1.6] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-px"
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_0%_0%,var(--brand-soft),transparent_55%),radial-gradient(90%_120%_at_100%_100%,var(--success-soft),transparent_60%)]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-3 top-px h-[45%] rounded-[18px_18px_40px_40px] bg-gradient-to-b from-white/75 to-white/0" />
      <span className="flex-1">Что нужно сделать?</span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[var(--primary)] text-white shadow-[0_6px_14px_-4px_color-mix(in_srgb,var(--brand)_60%,transparent),inset_0_1px_0_rgba(255,255,255,.35)]">
        <Plus className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden />
      </span>
    </button>
  );
}
