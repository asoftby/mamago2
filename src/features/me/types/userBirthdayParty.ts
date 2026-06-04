/** Ключевые слоты сценария (короткие подписи в flow, не названия офферов) */
export type ScenarioSlotKey =
  | "place"
  | "animator"
  | "decor"
  | "cake"
  | "photo"
  | "masterclass"
  | "food"
  | "games"
  | "other";

export type ScenarioFlowStep = {
  slot: ScenarioSlotKey;
  confirmed: boolean;
};

/** Статус праздника в ЛК (упрощённая модель до появления Prisma-сущности) */
export type UserBirthdayPartyStatus =
  | "draft"
  | "awaiting"
  | "partial"
  | "ready"
  | "completed"
  | "archived";

export type UserBirthdayParty = {
  id: string;
  /** Привязка к пользователю; `__every__` — показывать всем (демо) */
  userId: string;
  childName: string;
  /** Явное название или null — тогда «Праздник [имя]» */
  title: string | null;
  status: UserBirthdayPartyStatus;
  dateIso: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  /** 2–4 коротких позиции для превью */
  previewItems: string[];
  /** Для черновика без детализации */
  selectedServiceCount?: number;
  /** Прогресс согласования организаторов (карточка в профиле) */
  confirmationCount?: number;
  confirmationTotal?: number;
  /** Последовательность слотов сценария для компактного flow на карточке */
  scenarioFlow?: ScenarioFlowStep[];
  updatedAt: string;
};

export type UserBirthdayPartyServiceLine = {
  id: string;
  title: string;
  businessName: string | null;
  priceLabel: string | null;
};

export type OrganizerConfirmationStatus =
  | "pending"
  | "awaiting"
  | "confirmed"
  | "declined"
  /** Ответили сообщением, без финального подтверждения */
  | "messaged";

export type PerformerStatus = "CONFIRMED" | "PENDING" | "DECLINED";

export type AlternativePerformer = {
  id: string;
  category: string;
  title: string;
  rating?: number;
  price: number;
};

export type ScenarioTimelineItem = {
  id: string;
  time: string;
  type: "performer" | "internal";
  title: string;
  subtitle?: string;
  description?: string;
  price?: number;
  status?: PerformerStatus;
  contactLabel?: string;
  contact?: {
    name: string;
    phone: string;
    telegram?: string;
    messageHref?: string;
  };
  alternatives?: AlternativePerformer[];
};

/** Контакт исполнителя: всегда показываем в модалке (tel:, чат, ссылки) */
export type OrganizerContactItem = {
  label: string;
  /** tel:+…, https://…, mailto:… */
  href: string;
  /** Для подписи / стиля */
  kind?: "phone" | "chat" | "email" | "link";
};

export type UserBirthdayPartyOrganizer = {
  id: string;
  /** Слот сценария для группировки и порядка */
  roleSlot: ScenarioSlotKey;
  /** Заголовок роли: «Игровая комната», «Торт», «Место» */
  roleTitle: string;
  /** Время в плане дня (HH:mm), для сортировки таймлайна */
  timeLabel?: string | null;
  /** Компания или имя исполнителя */
  businessName: string;
  confirmation: OrganizerConfirmationStatus;
  /** Краткое описание (модалка) */
  summary?: string | null;
  /** Длительность / формат */
  durationOrFormat?: string | null;
  /** Цена, строка */
  priceLabel?: string | null;
  /** Контакты — не скрываем в модалке */
  contacts?: OrganizerContactItem[];
};

export type UserBirthdayPartyDetail = UserBirthdayParty & {
  scenarioLines: string[];
  /** Короткие подписи для блока «Сценарий» (без длинных офферов) */
  scenarioFlowLabels?: string[];
  themeLabel: string | null;
  durationHint: string | null;
  services: UserBirthdayPartyServiceLine[];
  organizers: UserBirthdayPartyOrganizer[];
  formatLabel: string;
  childAgeLabel?: string | null;
  guestsLabel?: string | null;
  totalPrice?: number | null;
  timelineItems?: ScenarioTimelineItem[];
};
