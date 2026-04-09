export type AdminNotificationType = "MODERATION" | "B2B" | "PAYMENT" | "SYSTEM";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  description?: string;
  link?: string;
  createdAt: string;
  read: boolean;
}

export const mockNotifications: AdminNotification[] = [
  {
    id: "1",
    type: "MODERATION",
    title: "Новое место на модерации",
    description: "Детский центр «Пуговка» ожидает проверки",
    link: "/admin/content/places",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
    read: false,
  },
  {
    id: "2",
    type: "B2B",
    title: "Новая заявка на верификацию",
    description: "ООО «Развитие» подало заявку на партнерство",
    link: "/admin/b2b/requests",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    read: false,
  },
  {
    id: "3",
    type: "PAYMENT",
    title: "Оплата тарифа Premium",
    description: "Детский центр «Солнышко» оплатил тариф на 12 месяцев",
    link: "/admin/billing/transactions",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    read: true,
  },
  {
    id: "4",
    type: "SYSTEM",
    title: "Ошибка синхронизации",
    description: "Не удалось синхронизировать данные с внешним API",
    link: "/admin/settings",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    read: false,
  },
  {
    id: "5",
    type: "MODERATION",
    title: "Обновление места",
    description: "Детский сад «Радуга» обновил информацию",
    link: "/admin/content/places",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    read: true,
  },
  {
    id: "6",
    type: "B2B",
    title: "Истекает срок договора",
    description: "Договор с ООО «Детство» истекает через 7 дней",
    link: "/admin/b2b/partners",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    read: true,
  },
];
