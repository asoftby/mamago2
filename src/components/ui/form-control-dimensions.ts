import { cn } from "@/lib/utils";

/**
 * Высота как у `components/ui/input.tsx` (`h-10`).
 * `SelectTrigger` по умолчанию `h-9` — без этого оверрайда поля разной высоты.
 */
export const formControlHeightClassName =
  "h-10 min-h-10 data-[size=default]:h-10 data-[size=default]:min-h-10";

/**
 * Узкий триггер выбора платформы в строке «соцсеть + URL» (шаг Контакты).
 */
export const formSocialPlatformSelectTriggerClassName = cn(
  formControlHeightClassName,
  "w-[11rem] shrink-0 justify-between gap-2 [&_svg]:opacity-50",
);
