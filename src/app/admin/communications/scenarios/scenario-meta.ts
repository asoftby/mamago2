import { Bell, Clock3, Lock, Mail, Send, ShieldCheck, type LucideIcon } from "lucide-react";

/**
 * Тип триггера определяет, какие параметры показываются на странице сценария:
 * - REMINDER — offset до события (используется джобой как lookahead)
 * - DIGEST — время дайджеста (пока задаётся кроном, поле не enforced)
 * - EVENT_DRIVEN — триггер продуктовое событие, временных параметров нет
 */
export type ScenarioTriggerKind = "REMINDER" | "DIGEST" | "EVENT_DRIVEN";

export type ScenarioMeta = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  triggerKind: ScenarioTriggerKind;
};

export const SCENARIO_META: Record<string, ScenarioMeta> = {
  PLAN_EVENT_2H_BEFORE: {
    title: "Напоминание о событии в плане",
    subtitle: "Точечный reminder перед стартом события.",
    icon: Clock3,
    triggerKind: "REMINDER",
  },
  PLAN_TOMORROW_DIGEST: {
    title: "Завтра в плане",
    subtitle: "Вечерняя сводка по завтрашним планам пользователя.",
    icon: Bell,
    triggerKind: "DIGEST",
  },
  BOOKING_REQUESTS: {
    title: "Заявки",
    subtitle: "Новые заявки и важные изменения по ним.",
    icon: Mail,
    triggerKind: "EVENT_DRIVEN",
  },
  ADMIN_MODERATION: {
    title: "Модерация",
    subtitle: "Сигналы для команды модерации и редакторов.",
    icon: ShieldCheck,
    triggerKind: "EVENT_DRIVEN",
  },
  BUSINESS_VERIFICATION: {
    title: "Верификация бизнеса",
    subtitle: "Статусы проверки бизнеса и сопутствующие шаги.",
    icon: Lock,
    triggerKind: "EVENT_DRIVEN",
  },
  SYSTEM_NOTIFICATIONS: {
    title: "Системные уведомления",
    subtitle: "Безопасность, критические статусы и сервисные сигналы.",
    icon: Send,
    triggerKind: "EVENT_DRIVEN",
  },
};

export function getScenarioMeta(key: string): ScenarioMeta {
  return (
    SCENARIO_META[key] ?? {
      title: key,
      subtitle: "Notification policy",
      icon: Bell,
      triggerKind: "EVENT_DRIVEN",
    }
  );
}
