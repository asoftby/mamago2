/**
 * Предопределённые должности для команды бизнеса.
 * Должность НЕ влияет на права доступа (это делает role).
 * Должность используется только для отображения в интерфейсе.
 */

export const TEAM_POSITIONS = [
  { value: "administrator", label: "Администратор" },
  { value: "manager", label: "Управляющий" },
  { value: "team_manager", label: "Менеджер" },
  { value: "editor", label: "Редактор" },
  { value: "smm", label: "SMM-специалист" },
  { value: "marketer", label: "Маркетолог" },
  { value: "customer_service", label: "Специалист по работе с клиентами" },
  { value: "custom", label: "Другое" },
] as const;

export type TeamPositionValue = typeof TEAM_POSITIONS[number]["value"];

export function getPositionLabel(value: string | null): string | null {
  if (!value) return null;
  const position = TEAM_POSITIONS.find((p) => p.value === value);
  return position ? position.label : value;
}
