/**
 * Единые состояния выбора «Мой план» (два стиля, не четыре):
 * — сегмент-контрол для взаимоисключающих 2–3 вариантов: белый активный сегмент на бежевой подложке;
 * — чип (участники, напоминание): активный чёрный фон + белый текст, неактивный — с обводкой.
 * Оранжевый — только primary-кнопка и акценты.
 */
export const PLAN_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-ac)]";

export const PLAN_SEG = "grid auto-cols-fr grid-flow-col gap-1 rounded-[15px] bg-[var(--mp-soft)] p-1";
export const PLAN_SEG_BTN = `mp-font-ui h-11 rounded-[11px] text-[14.5px] font-bold transition-colors ${PLAN_FOCUS}`;
export const PLAN_SEG_ON = "bg-white text-[var(--mp-tx)] shadow-[0_1px_3px_rgba(29,27,25,.12)]";
export const PLAN_SEG_OFF = "text-[var(--mp-tx2)]";

export const PLAN_CHIP = `mp-font-ui inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold transition-colors ${PLAN_FOCUS}`;
export const PLAN_CHIP_ON = "border-[var(--mp-chip-on-bg)] bg-[var(--mp-chip-on-bg)] text-[var(--mp-chip-on-tx)]";
export const PLAN_CHIP_OFF =
  "border-[var(--mp-chip-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] enabled:hover:border-[var(--mp-tx2)]";
/** Недоступный чип: явно «выключен» — приглушён и с курсором not-allowed. */
export const PLAN_CHIP_DISABLED = "disabled:cursor-not-allowed disabled:opacity-40";
