// Event Wizard Configuration

export const WIZARD_STEPS = [
  { id: 1, key: "basics", label: "Основная информация" },
  { id: 2, key: "description", label: "Описание" },
  { id: 3, key: "media", label: "Медиа" },
  { id: 4, key: "datetime", label: "Дата и время" },
  { id: 5, key: "price", label: "Стоимость" },
  { id: 6, key: "location", label: "Локация" },
  { id: 7, key: "contacts", label: "Контакты" },
  { id: 8, key: "organizer", label: "Организатор" },
  { id: 9, key: "faq", label: "Вопросы" },
  { id: 10, key: "review", label: "Проверка" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

export function getStepLabel(step: number): string {
  const stepConfig = WIZARD_STEPS.find(s => s.id === step);
  return stepConfig?.label || "";
}
