/**
 * Mock Dashboard Data Provider
 * 
 * Provides mock data for admin dashboard widgets where real data doesn't exist yet.
 * This allows UI testing without backend changes.
 */

export interface ActionCenterItem {
  id: string;
  type: "moderation" | "improvement" | "verification" | "notification";
  title: string;
  count: number;
  link: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface RevenueSnapshot {
  revenueToday: number;
  mrr: number;
  boostRevenue30d: number;
  newSubscriptions30d: number;
  leadsGenerated30d: number;
}

export interface MoneyRadarItem {
  id: string;
  title: string;
  description: string;
  count: number;
  link: string;
  potential: number; // Potential revenue in BYN
}

export interface NeedsAttentionItem {
  id: string;
  type: "place" | "event" | "improvement" | "business";
  title: string;
  description: string;
  link: string;
  severity: "low" | "medium" | "high";
}

export interface ContentQueueItem {
  id: string;
  label: string;
  count: number;
  link: string;
}

export interface ContentQualityItem {
  id: string;
  label: string;
  count: number;
  link: string;
  severity: "low" | "medium" | "high";
}

export interface RecentActivityItem {
  id: string;
  type: "approval" | "creation" | "edit" | "request";
  actor: string;
  action: string;
  entity: string;
  timestamp: Date;
  link?: string;
}

export function getActionCenterData(): ActionCenterItem[] {
  return [
    {
      id: "1",
      type: "moderation",
      title: "Места на модерации",
      count: 12,
      link: "/admin/content/places?status=PENDING",
      severity: "high",
    },
    {
      id: "2",
      type: "improvement",
      title: "Просроченные запросы на улучшение",
      count: 3,
      link: "/admin/content/places", // No dedicated improvement requests page yet
      severity: "high",
    },
    {
      id: "3",
      type: "verification",
      title: "B2B заявки на проверке",
      count: 5,
      link: "/admin/b2b/requests",
      severity: "medium",
    },
    {
      id: "4",
      type: "notification",
      title: "Критические уведомления",
      count: 2,
      link: "/admin/moderation/queue", // Use moderation queue as fallback
      severity: "high",
    },
  ];
}

export function getRevenueSnapshot(): RevenueSnapshot {
  return {
    revenueToday: 450.00,
    mrr: 12500.00,
    boostRevenue30d: 3200.00,
    newSubscriptions30d: 8,
    leadsGenerated30d: 45,
  };
}

export function getMoneyRadarData(): MoneyRadarItem[] {
  return [
    {
      id: "1",
      title: "Бизнесы без подписки",
      description: "Верифицированные бизнесы без активной подписки",
      count: 23,
      link: "/admin/billing/businesses",
      potential: 5750.00,
    },
    {
      id: "2",
      title: "Места без буста",
      description: "Популярные места без активного продвижения",
      count: 45,
      link: "/admin/commercial/placements",
      potential: 9000.00,
    },
    {
      id: "3",
      title: "Подписки истекают",
      description: "Подписки заканчиваются в ближайшие 7 дней",
      count: 12,
      link: "/admin/billing/businesses",
      potential: 3000.00,
    },
    {
      id: "4",
      title: "Неактивные бизнесы",
      description: "Бизнесы без активности более 30 дней",
      count: 18,
      link: "/admin/b2b/partners",
      potential: 4500.00,
    },
  ];
}

export function getNeedsAttentionData(): NeedsAttentionItem[] {
  return [
    {
      id: "1",
      type: "place",
      title: "Детский центр Радуга",
      description: "Отсутствует обложка",
      link: "/admin/content/places",
      severity: "medium",
    },
    {
      id: "2",
      type: "event",
      title: "Мастер-класс по рисованию",
      description: "Ожидает модерации 5 дней",
      link: "/admin/content/places",
      severity: "high",
    },
    {
      id: "3",
      type: "improvement",
      title: "Запрос #IR-2024-045",
      description: "Просрочен на 3 дня",
      link: "/admin/content/places",
      severity: "high",
    },
    {
      id: "4",
      type: "business",
      title: "ООО Детский мир",
      description: "Верификация не завершена",
      link: "/admin/b2b/requests",
      severity: "medium",
    },
    {
      id: "5",
      type: "place",
      title: "Парк развлечений Фантазия",
      description: "Отсутствуют SEO метаданные",
      link: "/admin/content/places",
      severity: "low",
    },
  ];
}

export function getContentQueuesData(): ContentQueueItem[] {
  return [
    {
      id: "1",
      label: "Места",
      count: 12,
      link: "/admin/content/places?status=PENDING",
    },
    {
      id: "2",
      label: "События",
      count: 8,
      link: "/admin/content/events?status=PENDING",
    },
    {
      id: "3",
      label: "Предложения",
      count: 5,
      link: "/admin/content/offers?status=PENDING",
    },
    {
      id: "4",
      label: "Маршруты",
      count: 3,
      link: "/admin/content/places", // No separate routes moderation yet
    },
  ];
}

export function getContentQualityData(): ContentQualityItem[] {
  return [
    {
      id: "1",
      label: "Без обложки",
      count: 15,
      link: "/admin/content/places",
      severity: "high",
    },
    {
      id: "2",
      label: "Без SEO метаданных",
      count: 34,
      link: "/admin/content/places",
      severity: "medium",
    },
    {
      id: "3",
      label: "Без таксономии",
      count: 8,
      link: "/admin/content/places",
      severity: "medium",
    },
    {
      id: "4",
      label: "Возможные дубликаты",
      count: 6,
      link: "/admin/content/places",
      severity: "low",
    },
  ];
}

export function getRecentActivityData(): RecentActivityItem[] {
  const now = new Date();
  
  return [
    {
      id: "1",
      type: "approval",
      actor: "Иван Петров",
      action: "одобрил место",
      entity: "Детский центр Радуга",
      timestamp: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
      link: "/admin/content/places",
    },
    {
      id: "2",
      type: "creation",
      actor: "ООО Детский мир",
      action: "создал предложение",
      entity: "Скидка 20% на день рождения",
      timestamp: new Date(now.getTime() - 15 * 60 * 1000), // 15 min ago
      link: "/admin/content/places",
    },
    {
      id: "3",
      type: "edit",
      actor: "Мария Сидорова",
      action: "отредактировал место",
      entity: "Парк развлечений Фантазия",
      timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      link: "/admin/content/places",
    },
    {
      id: "4",
      type: "request",
      actor: "Система",
      action: "создал запрос на улучшение",
      entity: "Место без контактов",
      timestamp: new Date(now.getTime() - 45 * 60 * 1000), // 45 min ago
      link: "/admin/content/places",
    },
    {
      id: "5",
      type: "approval",
      actor: "Иван Петров",
      action: "одобрил событие",
      entity: "Мастер-класс по рисованию",
      timestamp: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
      link: "/admin/content/places",
    },
    {
      id: "6",
      type: "creation",
      actor: "ООО Радуга",
      action: "создал место",
      entity: "Детская студия творчества",
      timestamp: new Date(now.getTime() - 90 * 60 * 1000), // 1.5 hours ago
      link: "/admin/content/places",
    },
    {
      id: "7",
      type: "edit",
      actor: "Мария Сидорова",
      action: "обновил контакты",
      entity: "Детский центр Солнышко",
      timestamp: new Date(now.getTime() - 120 * 60 * 1000), // 2 hours ago
      link: "/admin/content/places",
    },
  ];
}
