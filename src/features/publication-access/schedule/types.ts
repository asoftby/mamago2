/**
 * Редактор слотов: grouped state (день → слоты).
 * Расширяемо под recurring, weekly templates, copy-day, booked/remaining seats.
 */
export type ScheduleSlot = {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

export type ScheduleDay = {
  id: string;
  /** YYYY-MM-DD; пусто пока дата не выбрана */
  date: string;
  slots: ScheduleSlot[];
};

/** Опциональные расширения (пока не в UI — задел под API) */
export type ScheduleDayMeta = {
  /** Повтор по дням недели и т.д. */
  recurrenceRuleId?: string;
  /** Копия другого дня */
  copiedFromDayId?: string;
};
