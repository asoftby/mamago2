export type TelegramAnalyticsPeriod = "today" | "7d" | "30d";

export type TelegramDailyPoint = {
  date: string;
  received: number;
  addedToPlan: number;
};

export type TelegramFamilyAnalytics = {
  source: "live";
  environment: "DEV" | "PROD";
  period: TelegramAnalyticsPeriod;
  range: { start: string; end: string };
  connectedTotal: number;
  connectedInPeriod: number;
  activeUsers: number;
  returningUsers: number;
  inboxMessages: number;
  forwardedMessages: number;
  usersWithDrafts: number;
  confirmedUsers: number;
  addedPlanUsers: number;
  addedPlanItems: number;
  draftsPrepared: number;
  confirmedMessages: number;
  failedMessages: number;
  discardedMessages: number;
  editedMessages: number;
  avgProcessingSeconds: number | null;
  modelCalls: number;
  escalations: number;
  tokensIn: number;
  tokensOut: number;
  errorCodes: Array<{ code: string; count: number }>;
  daily: TelegramDailyPoint[];
};

export type TelegramBusinessDemoAnalytics = {
  source: "mock";
  period: TelegramAnalyticsPeriod;
  applications: number;
  delivered: number;
  opened: number;
  actions: number;
  confirmed: number;
  rejected: number;
  awaitingResponse: number;
  averageResponseMinutes: number;
  deliveryFailures: number;
  recentActions: Array<{ application: string; outcome: string; responseMinutes: number | null }>;
};

/** Isolated fixtures: no synthetic business numbers are written to production analytics. */
export const TELEGRAM_BUSINESS_DEMO: Record<TelegramAnalyticsPeriod, TelegramBusinessDemoAnalytics> = {
  today: {
    source: "mock", period: "today", applications: 4, delivered: 4, opened: 3,
    actions: 2, confirmed: 2, rejected: 0, awaitingResponse: 2,
    averageResponseMinutes: 14, deliveryFailures: 0,
    recentActions: [
      { application: "Праздник", outcome: "Подтверждено", responseMinutes: 12 },
      { application: "Мастер-класс", outcome: "Подтверждено", responseMinutes: 16 },
      { application: "Занятие", outcome: "Ожидает ответа", responseMinutes: null },
    ],
  },
  "7d": {
    source: "mock", period: "7d", applications: 27, delivered: 26, opened: 22,
    actions: 19, confirmed: 15, rejected: 4, awaitingResponse: 8,
    averageResponseMinutes: 23, deliveryFailures: 1,
    recentActions: [
      { application: "Праздник", outcome: "Подтверждено", responseMinutes: 12 },
      { application: "Мастер-класс", outcome: "Отклонено", responseMinutes: 34 },
      { application: "Занятие", outcome: "Ожидает ответа", responseMinutes: null },
    ],
  },
  "30d": {
    source: "mock", period: "30d", applications: 96, delivered: 93, opened: 77,
    actions: 66, confirmed: 53, rejected: 13, awaitingResponse: 30,
    averageResponseMinutes: 28, deliveryFailures: 3,
    recentActions: [
      { application: "Праздник", outcome: "Подтверждено", responseMinutes: 12 },
      { application: "Мастер-класс", outcome: "Отклонено", responseMinutes: 34 },
      { application: "Занятие", outcome: "Ожидает ответа", responseMinutes: null },
    ],
  },
};
