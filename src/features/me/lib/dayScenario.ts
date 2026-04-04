/**
 * Day Scenario Builder — slot-based model (MVP)
 *
 * Three day slots: Morning / Afternoon / Evening.
 * Each slot holds up to 3 alternatives; active index is managed in UI state.
 *
 * TODO: replace MOCK_POOL with real discovery API when ranking engine is ready.
 */

export type DaySlotId = "morning" | "afternoon" | "evening";

export interface DaySlotMeta {
  id: DaySlotId;
  label: string;
  timeRange: string;   // display only
  startHour: number;   // inclusive
  endHour: number;     // exclusive
}

export const DAY_SLOTS: DaySlotMeta[] = [
  { id: "morning",   label: "Утро",   timeRange: "08:00–12:00", startHour: 8,  endHour: 12 },
  { id: "afternoon", label: "День",   timeRange: "12:00–17:00", startHour: 12, endHour: 17 },
  { id: "evening",   label: "Вечер",  timeRange: "17:00–21:00", startHour: 17, endHour: 21 },
];

export interface ScenarioStep {
  id: string;
  time: string;        // exact time for display, e.g. "10:30"
  startHour: number;   // for slot assignment
  title: string;
  type: string;
  location: string;
  image: string;
  price?: string;
  interestTags: string[];
}

export interface SlotResult {
  slot: DaySlotMeta;
  /** Primary pick — up to 3 alternatives */
  alternatives: ScenarioStep[];
  /** Secondary pick — different activities for "add second" */
  secondaryAlternatives: ScenarioStep[];
}

export interface DayScenario {
  childName: string;
  childAge: string;
  matchedInterests: string[];
  /** Only slots that have at least one alternative */
  slots: SlotResult[];
}

// ── Mock pool ─────────────────────────────────────────────────────────────────

interface MockActivity {
  id: string;
  title: string;
  type: string;
  location: string;
  image: string;
  time: string;        // "HH:MM"
  price?: string;
  ageMin: number;
  ageMax: number;
  interests: string[];
}

const MOCK_POOL: MockActivity[] = [
  { id: "m1",  title: "Детский спектакль «Золушка»",   type: "Театр",        location: "Театр кукол",         image: "https://images.unsplash.com/photo-1503095396549-807759245b35?w=400&auto=format&fit=crop", time: "11:00", price: "от 12 BYN", ageMin: 3,  ageMax: 8,  interests: ["art","creativity"] },
  { id: "m2",  title: "Мастер-класс по лепке",         type: "Мастер-класс", location: "Арт-студия Краски",   image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&auto=format&fit=crop", time: "10:30", price: "от 25 BYN", ageMin: 4,  ageMax: 10, interests: ["art","creativity"] },
  { id: "m3",  title: "Интерактивный планетарий",      type: "Музей",        location: "Октябрьский р-н",     image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&auto=format&fit=crop", time: "12:00", price: "от 15 BYN", ageMin: 5,  ageMax: 14, interests: ["science","technology"] },
  { id: "m4",  title: "Детская йога",                  type: "Спорт",        location: "Центр, Минск",        image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&auto=format&fit=crop", time: "09:00", price: "от 20 BYN", ageMin: 4,  ageMax: 10, interests: ["sport","active-games"] },
  { id: "m5",  title: "Квест «Тайна старого замка»",   type: "Квест",        location: "Немига",              image: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&auto=format&fit=crop", time: "14:00", price: "от 40 BYN", ageMin: 6,  ageMax: 14, interests: ["active-games","creativity"] },
  { id: "m6",  title: "Сенсорная комната",             type: "Развитие",     location: "Центр Умка",          image: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&auto=format&fit=crop", time: "10:00", price: "от 15 BYN", ageMin: 1,  ageMax: 5,  interests: ["quiet-activities"] },
  { id: "m7",  title: "Мастер-класс по рисованию",     type: "Мастер-класс", location: "Троицкое предместье", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&auto=format&fit=crop", time: "13:00", price: "от 30 BYN", ageMin: 5,  ageMax: 12, interests: ["art"] },
  { id: "m8",  title: "Детский бассейн",               type: "Спорт",        location: "Аквацентр Лазурный",  image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=400&auto=format&fit=crop", time: "11:00", price: "от 18 BYN", ageMin: 3,  ageMax: 12, interests: ["sport"] },
  { id: "m9",  title: "Музыкальный кружок",            type: "Музыка",       location: "Центр, Минск",        image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&auto=format&fit=crop", time: "10:30", price: "от 22 BYN", ageMin: 3,  ageMax: 8,  interests: ["music","dance"] },
  { id: "m10", title: "Игровая комната «Джунгли»",     type: "Игровая",      location: "ТЦ Galleria",         image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop", time: "13:30", price: "Бесплатно",  ageMin: 2,  ageMax: 8,  interests: ["active-games","quiet-activities"] },
  { id: "m11", title: "Велопрогулка по набережной",    type: "Прогулка",     location: "Набережная Свислочи", image: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=400&auto=format&fit=crop", time: "09:30", price: "Бесплатно",  ageMin: 4,  ageMax: 14, interests: ["sport","nature"] },
  { id: "m12", title: "Зоопарк: утреннее кормление",   type: "Зоопарк",      location: "Минский зоопарк",     image: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=400&auto=format&fit=crop", time: "10:30", price: "от 10 BYN", ageMin: 2,  ageMax: 10, interests: ["animals","nature"] },
  { id: "m13", title: "Конструкторский клуб LEGO",     type: "Развитие",     location: "Центр, Минск",        image: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&auto=format&fit=crop", time: "11:00", price: "от 25 BYN", ageMin: 5,  ageMax: 12, interests: ["construction","technology"] },
  { id: "m14", title: "Танцевальный мастер-класс",     type: "Танцы",        location: "Студия танца",        image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop", time: "18:00", price: "от 20 BYN", ageMin: 4,  ageMax: 10, interests: ["dance","music"] },
  { id: "m15", title: "Читальный клуб для детей",      type: "Чтение",       location: "Библиотека",          image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&auto=format&fit=crop", time: "16:00", price: "Бесплатно",  ageMin: 5,  ageMax: 12, interests: ["books","quiet-activities"] },
  { id: "m16", title: "Вечерний кинотеатр для семей",  type: "Кино",         location: "Мультиплекс",         image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop", time: "19:00", price: "от 14 BYN", ageMin: 4,  ageMax: 14, interests: ["art","quiet-activities"] },
  { id: "m17", title: "Боулинг для детей",             type: "Спорт",        location: "ТЦ Арена",            image: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&auto=format&fit=crop", time: "17:30", price: "от 22 BYN", ageMin: 5,  ageMax: 14, interests: ["sport","active-games"] },
  { id: "m18", title: "Детское кафе с мастер-классом", type: "Кафе",         location: "Центр, Минск",        image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop", time: "14:30", price: "от 30 BYN", ageMin: 3,  ageMax: 10, interests: ["creativity","quiet-activities"] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function ageInYears(birthDate: Date): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function ageLabel(years: number): string {
  if (years < 1) return "до 1 года";
  if (years === 1) return "1 год";
  if (years < 5) return `${years} года`;
  return `${years} лет`;
}

function parseHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

function toStep(a: MockActivity): ScenarioStep {
  return {
    id: a.id,
    time: a.time,
    startHour: parseHour(a.time),
    title: a.title,
    type: a.type,
    location: a.location,
    image: a.image,
    price: a.price,
    interestTags: a.interests,
  };
}

const MAX_ALTS = 2; // max per primary pool, leaves room for secondary

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildDayScenario(
  child: {
    name: string;
    birthDate: Date;
    systemInterests?: { interestSlug: string }[];
    /** Override interests (used for multi-child merge) */
    mergedInterests?: string[];
  },
  globalSeed: number,
): DayScenario | null {
  const years = ageInYears(child.birthDate);
  const interests = child.mergedInterests ?? child.systemInterests?.map((i) => i.interestSlug) ?? [];

  // Filter by age
  const ageMatched = MOCK_POOL.filter((a) => years >= a.ageMin && years <= a.ageMax);
  if (ageMatched.length === 0) return null;

  // Score by interest overlap + deterministic shuffle via globalSeed
  const scored = ageMatched
    .map((a) => ({ ...a, score: a.interests.filter((i) => interests.includes(i)).length }))
    .sort((a, b) => b.score - a.score || (a.id > b.id ? 1 : -1));

  // Rotate pool by globalSeed for "another scenario" behaviour
  const rotated = [...scored.slice(globalSeed % scored.length), ...scored.slice(0, globalSeed % scored.length)];

  // Assign to slots
  const slots: SlotResult[] = DAY_SLOTS.map((slot) => {
    const candidates = rotated.filter(
      (a) => parseHour(a.time) >= slot.startHour && parseHour(a.time) < slot.endHour,
    );
    const primary = candidates.slice(0, MAX_ALTS);
    // Secondary: different from primary pool
    const primaryIds = new Set(primary.map((a) => a.id));
    const secondary = rotated
      .filter((a) => !primaryIds.has(a.id) && parseHour(a.time) >= slot.startHour && parseHour(a.time) < slot.endHour)
      .slice(0, MAX_ALTS);
    return {
      slot,
      alternatives: primary.map(toStep),
      secondaryAlternatives: secondary.map(toStep),
    };
  }).filter((s) => s.alternatives.length > 0);

  if (slots.length === 0) return null;

  const allInterests = slots.flatMap((s) => s.alternatives[0]?.interestTags ?? []);
  const matchedInterests = [...new Set(allInterests)].filter((i) => interests.includes(i));

  return { childName: child.name, childAge: ageLabel(years), matchedInterests, slots };
}
