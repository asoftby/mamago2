import type { ClusterKey } from "./places.data";

/** Day slots relative to the apply date: the next two Saturdays/Sundays and the next Wednesday. */
export type DaySlot = "sat1" | "sun1" | "sat2" | "sun2" | "wed1";
export const DAY_SLOTS: DaySlot[] = ["sat1", "sun1", "sat2", "sun2", "wed1"];

export type MockEventSpec = {
  key: string;
  cluster: ClusterKey;
  title: string;
  /** Key of a mock place, or null for the "metro only" event. */
  placeKey: string | null;
  /** Metro station name fragment for the event without a place. */
  metroLike?: string;
  ages: string[];
  /** ONE_TIME / MULTI_DATE events have sessions; RECURRING is created without any ActivitySession. */
  mode: "ONE_TIME" | "MULTI_DATE" | "RECURRING";
  /** Local Minsk start times per day slot ("HH:MM"). */
  sessions: Partial<Record<DaySlot, string[]>>;
  note?: string;
};

/** Mixed morning (10:00), day (13:00-15:30) and evening (18:00+) starts; several overlap on purpose. */
export const MOCK_EVENTS: MockEventSpec[] = [
  // --- Центр (6) ---
  { key: "c-draw", cluster: "center", title: "[MOCK] Мастер-класс по рисованию", placeKey: "center-creative-1", ages: ["5-7", "7-9"], mode: "MULTI_DATE", sessions: { sat1: ["10:00", "14:00"], sun1: ["11:00"], wed1: ["17:00"] } },
  { key: "c-puppets", cluster: "center", title: "[MOCK] Спектакль для малышей", placeKey: "center-ent-1", ages: ["0-1", "1-3"], mode: "MULTI_DATE", sessions: { sat1: ["11:00"], sat2: ["11:00"], sun1: ["11:30"] }, note: "пересекается с мастер-классом по времени" },
  { key: "c-museum", cluster: "center", title: "[MOCK] Экскурсия в музей", placeKey: "center-museum-1", ages: ["7-9", "9-12"], mode: "MULTI_DATE", sessions: { sat1: ["14:30"], sun1: ["14:00"], wed1: ["18:00"] } },
  { key: "c-quest", cluster: "center", title: "[MOCK] Квест для подростков", placeKey: "center-play-1", ages: ["12-14", "14-16"], mode: "MULTI_DATE", sessions: { sat1: ["18:30"], sat2: ["18:30"], wed1: ["19:00"] } },
  { key: "c-metro", cluster: "center", title: "[MOCK] Семейный праздник (только метро)", placeKey: null, metroLike: "Купаловская", ages: ["3-5", "5-7", "7-9"], mode: "MULTI_DATE", sessions: { sat1: ["15:00"], sun1: ["15:00"], wed1: ["16:30"] }, note: "нет места: приближение по станции метро" },
  { key: "c-nocoords", cluster: "center", title: "[MOCK] Событие: место без координат", placeKey: "center-nocoords-1", ages: ["3-5", "5-7"], mode: "MULTI_DATE", sessions: { sat1: ["13:00"], sun1: ["13:00"] }, note: "место есть, координат нет" },
  // --- Уручье / Зелёный Луг (3) ---
  { key: "u-football", cluster: "uruche", title: "[MOCK] Детский футбольный турнир", placeKey: "uruche-sport-1", ages: ["7-9", "9-12"], mode: "MULTI_DATE", sessions: { sat1: ["10:30"], sun1: ["10:30"], wed1: ["17:30"] } },
  { key: "u-studio", cluster: "uruche", title: "[MOCK] Творческая студия: аппликация", placeKey: "uruche-creative-1", ages: ["3-5", "5-7"], mode: "MULTI_DATE", sessions: { sat1: ["15:30"], sat2: ["15:30"] } },
  { key: "u-cinema", cluster: "uruche", title: "[MOCK] Детский киносеанс", placeKey: "uruche-ent-1", ages: ["3-5", "5-7"], mode: "MULTI_DATE", sessions: { sun1: ["12:00"], sun2: ["12:00"], wed1: ["16:30"] } },
  // --- Каменная Горка (3) ---
  { key: "k-swim", cluster: "kamgorka", title: "[MOCK] Открытое занятие по плаванию", placeKey: "kamgorka-sport-1", ages: ["5-7", "7-9"], mode: "MULTI_DATE", sessions: { sat1: ["09:30"], sun2: ["10:00"] } },
  { key: "k-walk", cluster: "kamgorka", title: "[MOCK] Эко-прогулка по парку", placeKey: "kamgorka-park-1", ages: ["3-5", "5-7", "7-9"], mode: "MULTI_DATE", sessions: { sat2: ["12:00"], sun1: ["12:00"], wed1: ["17:00"] } },
  { key: "k-science", cluster: "kamgorka", title: "[MOCK] Научное шоу", placeKey: "kamgorka-museum-1", ages: ["7-9", "9-12"], mode: "MULTI_DATE", sessions: { sat1: ["16:00"], sat2: ["16:00"] } },
  // --- Серебрянка / Чижовка (2) ---
  { key: "s-play", cluster: "serebr", title: "[MOCK] Игровой день для малышей", placeKey: "serebr-play-1", ages: ["0-1", "1-3"], mode: "MULTI_DATE", sessions: { sat1: ["11:00"], sun1: ["11:00"] } },
  { key: "s-clay", cluster: "serebr", title: "[MOCK] Мастер-класс по лепке", placeKey: "serebr-creative-1", ages: ["5-7", "7-9"], mode: "MULTI_DATE", sessions: { sat1: ["14:00"], wed1: ["18:00"] } },
  // --- Пригород (1) ---
  { key: "b-fest", cluster: "bor", title: "[MOCK] Семейный фестиваль в Боровлянах", placeKey: "bor-park-1", ages: ["3-5", "5-7", "7-9", "9-12"], mode: "MULTI_DATE", sessions: { sat1: ["12:00"], sun1: ["12:00"] } },
  // --- Повторяющееся без сеансов (для проверки разворота повторов) ---
  { key: "c-weekly", cluster: "center", title: "[MOCK] Еженедельное занятие (RECURRING, без сеансов)", placeKey: "center-creative-2", ages: ["5-7", "7-9"], mode: "RECURRING", sessions: {}, note: "scheduleJson с недельным повтором, ActivitySession нет" },
];
