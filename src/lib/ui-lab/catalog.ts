export type ApprovalStatus = "draft" | "review" | "approved" | "legacy";
export type CatalogScope = "common" | "public" | "business" | "admin";

export type CatalogEntry = {
  id: string;
  title: string;
  source: string;
  status: ApprovalStatus;
  scope: CatalogScope;
  note: string;
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  draft: "Черновик",
  review: "На согласовании",
  approved: "Утверждён",
  legacy: "Устарел",
};

/**
 * Explicit editorial decision registry: status is NOT inferred from whether a
 * component renders. No visual variant is approved until reviewed by owner.
 */
export const UI_LAB_CATALOG: CatalogEntry[] = [
  { id:"button", title:"Кнопки", source:"src/components/ui/button.tsx", status:"review", scope:"common", note:"Сверить размеры и радиус с PrimaryButton" },
  { id:"primary-button", title:"PrimaryButton", source:"src/components/ui/PrimaryButton.tsx", status:"legacy", scope:"common", note:"CTA-обёртка; сохранить пока есть использования" },
  { id:"chip", title:"Чип выбора", source:"src/components/ui/Chip.tsx", status:"review", scope:"common", note:"Согласовать selected, focus, disabled" },
  { id:"chips-row", title:"Группа чипов", source:"src/components/ui/chips-row.tsx", status:"review", scope:"common", note:"Скролл, перенос, возрастные группы" },
  { id:"badge", title:"Бейдж", source:"src/components/ui/badge.tsx", status:"review", scope:"common", note:"Информационный, не интерактивный" },
  { id:"input", title:"Поле ввода", source:"src/components/ui/input.tsx", status:"review", scope:"common", note:"iOS 16px; label/error/disabled" },
  { id:"textarea", title:"Многострочное поле", source:"src/components/ui/textarea.tsx", status:"review", scope:"common", note:"iOS 16px; валидация" },
  { id:"filter", title:"Фильтры каталога", source:"src/features/discovery/filters/DiscoveryFilters.tsx", status:"review", scope:"public", note:"Desktop/mobile различия допустимы" },
  { id:"activity-card", title:"Карточки событий", source:"src/components/content-cards/ActivityCard.tsx", status:"review", scope:"public", note:"Карточка одна, variant/density/actions" },
  { id:"wizard", title:"Мастер создания", source:"src/components/form-shell", status:"draft", scope:"business", note:"Проверить переключение шагов и адаптивность" },
  { id:"admin-forms", title:"Формы админки", source:"src/app/(ui)/ui-lab-admin/_sections/FormsSection.tsx", status:"legacy", scope:"admin", note:"Архив примеров, не источник стилевых правил" },
];
