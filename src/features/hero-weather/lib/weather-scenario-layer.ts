import type { ActivityMock } from "@/mocks/activity.types";
import type { TimeOfDay, WeatherScenario } from "../model/types";

export type HomeWeatherScenario =
  | "sunny_outdoor"
  | "rain_indoor"
  | "windy_caution"
  | "cold_indoor"
  | "hot_mixed"
  | "cloudy_mixed"
  | "snow_indoor"
  | "storm_caution";

type WeatherAffinity = "indoor" | "outdoor" | "sheltered" | "water" | "mixed";

type WeatherCopyVariant = {
  condition: string;
  advice: string;
};

type WeatherCopyInput = {
  emoji: string;
  scenario: HomeWeatherScenario;
  timeOfDay: TimeOfDay;
  maxTemperatureC: number | null;
};

const WEATHER_COPY_POOL: Record<HomeWeatherScenario, Record<TimeOfDay, WeatherCopyVariant[]>> = {
  sunny_outdoor: {
    morning: [
      { condition: "солнечно", advice: "отличный старт для прогулки" },
      { condition: "солнечно", advice: "лучше не откладывать прогулку" },
      { condition: "солнечно", advice: "день хорошо начать на улице" },
      { condition: "солнечно", advice: "утро отлично подходит для маршрутов" },
    ],
    day: [
      { condition: "солнечно", advice: "отличный день для прогулки" },
      { condition: "солнечно", advice: "комфортная погода для улицы" },
      { condition: "солнечно", advice: "можно смело выбирать outdoor" },
      { condition: "солнечно", advice: "самое время для прогулки" },
    ],
    evening: [
      { condition: "солнечно", advice: "вечер подойдёт для прогулки" },
      { condition: "ясно", advice: "можно спокойно выбрать outdoor" },
      { condition: "солнечно", advice: "вечером будет приятно пройтись" },
      { condition: "ясно", advice: "хорошее время для прогулки" },
    ],
    night: [
      { condition: "ясно", advice: "вечер хорошо подходит для спокойной прогулки" },
      { condition: "ясно", advice: "можно выбрать что-то на свежем воздухе" },
      { condition: "безоблачно", advice: "комфортно для короткой прогулки" },
      { condition: "ясно", advice: "на улице будет приятно задержаться" },
    ],
  },
  rain_indoor: {
    morning: [
      { condition: "дождливо", advice: "лучше начать день в помещении" },
      { condition: "дождливо", advice: "уютные места будут особенно кстати" },
      { condition: "сыро", advice: "лучше выбирать indoor-варианты" },
      { condition: "дождливо", advice: "хорошее утро для тёплых мест" },
    ],
    day: [
      { condition: "дождливо", advice: "лучше выбрать что-то в помещении" },
      { condition: "дождливо", advice: "уютные места будут особенно кстати" },
      { condition: "сыро", advice: "комфортнее будет под крышей" },
      { condition: "дождливо", advice: "самое время для indoor-планов" },
    ],
    evening: [
      { condition: "дождливо", advice: "уютные места будут кстати" },
      { condition: "дождливо", advice: "вечером комфортнее будет в помещении" },
      { condition: "сыро", advice: "лучше выбрать спокойные indoor-варианты" },
      { condition: "дождливо", advice: "хорошее время для тёплых мест" },
    ],
    night: [
      { condition: "дождливо", advice: "вечер лучше провести в помещении" },
      { condition: "сыро", advice: "уютные места будут особенно кстати" },
      { condition: "дождливо", advice: "комфортнее будет под крышей" },
      { condition: "дождливо", advice: "лучше выбрать indoor-варианты" },
    ],
  },
  windy_caution: {
    morning: [
      { condition: "ветрено", advice: "лучше начать день в помещении" },
      { condition: "ветрено", advice: "хорошее время для уютных мест" },
      { condition: "ветрено и прохладно", advice: "лучше выбрать indoor-варианты" },
      { condition: "на улице ветер", advice: "утро комфортнее провести в помещении" },
    ],
    day: [
      { condition: "ветрено", advice: "лучше выбрать что-то в помещении" },
      { condition: "на улице ветер", advice: "хорошее время для уютных мест" },
      { condition: "ветрено и прохладно", advice: "давайте смотреть indoor-варианты" },
      { condition: "ветрено", advice: "комфортнее будет в помещении" },
    ],
    evening: [
      { condition: "ветрено", advice: "хорошее время для спокойных мест" },
      { condition: "ветрено", advice: "вечером лучше выбирать что-то под крышей" },
      { condition: "на улице ветер", advice: "уютные места будут особенно кстати" },
      { condition: "ветрено и прохладно", advice: "лучше выбрать indoor-варианты" },
    ],
    night: [
      { condition: "ветрено", advice: "вечером комфортнее будет в помещении" },
      { condition: "на улице ветер", advice: "лучше выбрать спокойные места" },
      { condition: "ветрено", advice: "под крышей будет заметно уютнее" },
      { condition: "ветрено и прохладно", advice: "лучше не планировать долгие прогулки" },
    ],
  },
  cold_indoor: {
    morning: [
      { condition: "прохладно", advice: "одевайтесь теплее" },
      { condition: "холодно", advice: "лучше начать день в тёплом месте" },
      { condition: "прохладно", advice: "уютные варианты будут особенно кстати" },
      { condition: "холодно", advice: "утром комфортнее выбирать indoor" },
    ],
    day: [
      { condition: "холодно", advice: "одевайтесь теплее" },
      { condition: "прохладно", advice: "лучше выбрать что-то в помещении" },
      { condition: "холодно", advice: "тёплые места сегодня особенно кстати" },
      { condition: "прохладно", advice: "комфортнее будет в помещении" },
    ],
    evening: [
      { condition: "прохладно", advice: "к вечеру лучше выбирать тёплые места" },
      { condition: "холодно", advice: "уютные варианты будут особенно кстати" },
      { condition: "прохладно", advice: "лучше выбрать что-то в помещении" },
      { condition: "холодно", advice: "стоит одеться теплее" },
    ],
    night: [
      { condition: "холодно", advice: "вечером особенно кстати тёплые места" },
      { condition: "прохладно", advice: "лучше выбрать что-то в помещении" },
      { condition: "холодно", advice: "уютные варианты будут комфортнее" },
      { condition: "прохладно", advice: "на улице будет зябко" },
    ],
  },
  hot_mixed: {
    morning: [
      { condition: "тепло", advice: "лучше планировать короткие выходы" },
      { condition: "становится жарко", advice: "чередуйте улицу и прохладу" },
      { condition: "жарковато", advice: "лучше выбирать места с тенью" },
      { condition: "тепло", advice: "утром удобно комбинировать улицу и indoor" },
    ],
    day: [
      { condition: "жарко", advice: "лучше чередовать улицу и прохладу" },
      { condition: "жарко", advice: "прохладные места сегодня особенно кстати" },
      { condition: "жарковато", advice: "лучше планировать короткие выходы" },
      { condition: "тепло", advice: "подойдут места с водой или тенью" },
    ],
    evening: [
      { condition: "тепло", advice: "вечером комфортно комбинировать улицу и indoor" },
      { condition: "жарковато", advice: "лучше выбирать места с тенью" },
      { condition: "тепло", advice: "можно чередовать прогулку и прохладу" },
      { condition: "ещё тепло", advice: "прохладные места будут кстати" },
    ],
    night: [
      { condition: "тепло", advice: "вечером подойдут спокойные места с прохладой" },
      { condition: "ещё тепло", advice: "лучше чередовать улицу и indoor" },
      { condition: "жарковато", advice: "комфортнее будет в прохладных местах" },
      { condition: "тепло", advice: "подойдут места с водой или тенью" },
    ],
  },
  cloudy_mixed: {
    morning: [
      { condition: "облачно", advice: "комфортно начать день на улице" },
      { condition: "облачно", advice: "можно спокойно планировать прогулку" },
      { condition: "пасмурно", advice: "подходит и для улицы, и для indoor" },
      { condition: "облачно", advice: "хорошая погода для спокойных планов" },
    ],
    day: [
      { condition: "облачно", advice: "комфортная погода для прогулки" },
      { condition: "облачно", advice: "можно спокойно планировать прогулку" },
      { condition: "пасмурно", advice: "подойдут и улица, и indoor" },
      { condition: "облачно", advice: "комфортная погода для улицы" },
    ],
    evening: [
      { condition: "облачно", advice: "вечером комфортно для прогулки" },
      { condition: "пасмурно", advice: "можно выбрать и улицу, и indoor" },
      { condition: "облачно", advice: "хорошая погода для спокойных мест" },
      { condition: "облачно", advice: "подойдут любые спокойные планы" },
    ],
    night: [
      { condition: "облачно", advice: "вечер подойдёт для спокойных планов" },
      { condition: "пасмурно", advice: "комфортно и на улице, и в помещении" },
      { condition: "облачно", advice: "можно выбрать формат по настроению" },
      { condition: "облачно", advice: "подойдут любые спокойные варианты" },
    ],
  },
  snow_indoor: {
    morning: [
      { condition: "снежно", advice: "утром лучше выбирать тёплые места" },
      { condition: "снежно", advice: "одевайтесь теплее" },
      { condition: "снежно", advice: "уютные места будут особенно кстати" },
      { condition: "идёт снег", advice: "лучше начать день в помещении" },
    ],
    day: [
      { condition: "снежно", advice: "тёплые места сегодня особенно кстати" },
      { condition: "снежно", advice: "лучше выбрать что-то в помещении" },
      { condition: "идёт снег", advice: "уютные варианты будут комфортнее" },
      { condition: "снежно", advice: "одевайтесь теплее" },
    ],
    evening: [
      { condition: "снежно", advice: "вечером особенно кстати тёплые места" },
      { condition: "идёт снег", advice: "лучше выбрать что-то в помещении" },
      { condition: "снежно", advice: "уютные места будут кстати" },
      { condition: "снежно", advice: "на улице лучше не задерживаться" },
    ],
    night: [
      { condition: "снежно", advice: "вечером комфортнее будет в тёплых местах" },
      { condition: "идёт снег", advice: "лучше выбирать indoor-варианты" },
      { condition: "снежно", advice: "уютные места будут особенно кстати" },
      { condition: "снежно", advice: "стоит одеться теплее" },
    ],
  },
  storm_caution: {
    morning: [
      { condition: "неспокойно на улице", advice: "лучше начать день в помещении" },
      { condition: "ветрено и сыро", advice: "уютные места будут особенно кстати" },
      { condition: "погода резко меняется", advice: "лучше выбрать indoor-варианты" },
      { condition: "на улице неспокойно", advice: "лучше не планировать долгие прогулки" },
    ],
    day: [
      { condition: "неспокойно на улице", advice: "лучше выбрать что-то в помещении" },
      { condition: "ветрено и сыро", advice: "уютные места будут особенно кстати" },
      { condition: "погода резко меняется", advice: "лучше не планировать долгие прогулки" },
      { condition: "на улице неспокойно", advice: "комфортнее будет под крышей" },
    ],
    evening: [
      { condition: "ветрено и сыро", advice: "к вечеру лучше выбирать спокойные места" },
      { condition: "на улице неспокойно", advice: "уютные места будут кстати" },
      { condition: "погода резко меняется", advice: "лучше выбрать indoor-варианты" },
      { condition: "неспокойно на улице", advice: "лучше не планировать прогулку" },
    ],
    night: [
      { condition: "на улице неспокойно", advice: "вечером лучше оставаться в помещении" },
      { condition: "ветрено и сыро", advice: "уютные места будут особенно кстати" },
      { condition: "погода резко меняется", advice: "лучше выбирать indoor-варианты" },
      { condition: "неспокойно на улице", advice: "лучше не затягивать прогулку" },
    ],
  },
};

const OUTDOOR_KEYWORDS = [
  "парк",
  "прогул",
  "маршрут",
  "экотроп",
  "зоопарк",
  "усадьб",
  "сад",
  "набереж",
  "фестиваль",
  "ярмарк",
  "экскурс",
  "аттракцион",
  "веревоч",
  "улиц",
  "outdoor",
  "nature",
];

const INDOOR_KEYWORDS = [
  "музей",
  "театр",
  "спектак",
  "кино",
  "квест",
  "мастер-класс",
  "студи",
  "класс",
  "центр",
  "игров",
  "кафе",
  "помещен",
  "галере",
  "лектор",
  "выставк",
  "концерт",
  "батут",
  "музык",
  "indoor",
  "museum",
  "theatre",
];

const SHELTERED_KEYWORDS = [
  "терраса",
  "под крышей",
  "павильон",
  "галерея",
  "фудкорт",
  "торгов",
];

const WATER_KEYWORDS = [
  "бассейн",
  "аквапарк",
  "вода",
  "пляж",
  "озеро",
  "река",
  "water",
];

function countKeywordHits(source: string, keywords: string[]): number {
  return keywords.reduce((sum, keyword) => sum + (source.includes(keyword) ? 1 : 0), 0);
}

function formatSignedTemperature(temp: number | null): string {
  if (temp == null || Number.isNaN(temp)) return "";
  const rounded = Math.round(temp);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

export function resolveDayTime(now: Date, timezone?: string): TimeOfDay {
  let hour: number;

  if (timezone) {
    // Get local hour in the given timezone using Intl
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).formatToParts(now);
      const hourPart = parts.find((p) => p.type === "hour");
      hour = hourPart ? parseInt(hourPart.value, 10) : now.getHours();
    } catch {
      hour = now.getHours();
    }
  } else {
    hour = now.getHours();
  }

  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "day";
  if (hour >= 18 && hour <= 21) return "evening";
  return "night";
}

export function resolveHomeWeatherScenario(input: {
  scenario: WeatherScenario;
  maxTemperatureC: number | null;
}): HomeWeatherScenario {
  switch (input.scenario) {
    case "great_outdoor":
    case "good_outdoor":
      return "sunny_outdoor";
    case "rain_indoor":
    case "heavy_rain_indoor":
      return "rain_indoor";
    case "windy_caution":
      return "windy_caution";
    case "cold_mixed":
    case "ice_alert":
      return "cold_indoor";
    case "snow_indoor":
      return "snow_indoor";
    case "storm_alert":
      return "storm_caution";
    case "hot_caution":
      return "hot_mixed";
    case "mixed_outdoor":
    case "unknown":
    default:
      if (input.maxTemperatureC != null && input.maxTemperatureC >= 26) {
        return "hot_mixed";
      }
      if (input.maxTemperatureC != null && input.maxTemperatureC <= 4) {
        return "cold_indoor";
      }
      return "cloudy_mixed";
  }
}

function timePrefix(timeOfDay: TimeOfDay): string {
  switch (timeOfDay) {
    case "morning":
      return "С утра";
    case "evening":
      return "К вечеру";
    case "night":
      return "Этим вечером";
    case "day":
    default:
      return "Сегодня";
  }
}

function weatherCopyVariant(
  scenario: HomeWeatherScenario,
  timeOfDay: TimeOfDay,
  maxTemperatureC: number | null,
): WeatherCopyVariant {
  const variants = WEATHER_COPY_POOL[scenario][timeOfDay];
  const variantSeed = Math.abs(Math.round(maxTemperatureC ?? 0)) % variants.length;
  return variants[variantSeed];
}

export function getWeatherCopy(input: WeatherCopyInput): string {
  const prefix = timePrefix(input.timeOfDay);
  const variant = weatherCopyVariant(input.scenario, input.timeOfDay, input.maxTemperatureC);
  const temp = formatSignedTemperature(input.maxTemperatureC);
  const tempPart = temp ? `, до ${temp}` : "";
  return `${input.emoji} ${prefix} ${variant.condition}${tempPart} — ${variant.advice}`;
}

export function getWeatherIconName(input: {
  scenario: HomeWeatherScenario;
  timeOfDay: TimeOfDay;
}): string {
  switch (input.scenario) {
    case "sunny_outdoor":
      return input.timeOfDay === "night" ? "overcast-night" : "clear-day";
    case "rain_indoor":
      return "overcast-rain";
    case "windy_caution":
      return "wind";
    case "cold_indoor":
      return "thermometer-colder";
    case "hot_mixed":
      return "thermometer-warmer";
    case "snow_indoor":
      return "snowflake";
    case "storm_caution":
      return "thunderstorms-day-rain";
    case "cloudy_mixed":
    default:
      return input.timeOfDay === "night" ? "overcast-night" : "overcast-day";
  }
}

function inferWeatherAffinity(activity: ActivityMock): WeatherAffinity {
  const text = [
    activity.title,
    activity.description,
    activity.badge,
    activity.geoBadge,
    activity.ageHintBadge,
    ...(activity.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let indoorScore = 0;
  let outdoorScore = 0;
  let shelteredScore = 0;
  let waterScore = 0;

  if (activity.type === "CLASS_SCHEDULE") indoorScore += 2;
  if (activity.discoveryIntent === "routes") outdoorScore += 2;

  indoorScore += countKeywordHits(text, INDOOR_KEYWORDS) * 2;
  outdoorScore += countKeywordHits(text, OUTDOOR_KEYWORDS) * 2;
  shelteredScore += countKeywordHits(text, SHELTERED_KEYWORDS) * 2;
  waterScore += countKeywordHits(text, WATER_KEYWORDS) * 3;

  if (activity.tags.includes("outdoor")) outdoorScore += 3;
  if (activity.tags.includes("water")) waterScore += 3;
  if (activity.tags.includes("museum") || activity.tags.includes("theatre")) indoorScore += 2;

  if (waterScore >= Math.max(indoorScore, outdoorScore) + 1) return "water";
  if (indoorScore >= outdoorScore + 2) return shelteredScore >= 2 ? "sheltered" : "indoor";
  if (outdoorScore >= indoorScore + 2) return "outdoor";
  if (shelteredScore >= 2) return "sheltered";
  return "mixed";
}

export function getWeatherRankingBoost(
  activity: ActivityMock,
  context: { scenario: HomeWeatherScenario; timeOfDay: TimeOfDay },
): number {
  const affinity = inferWeatherAffinity(activity);
  let boost = 0;

  switch (context.scenario) {
    case "rain_indoor":
    case "snow_indoor":
    case "storm_caution":
      if (affinity === "indoor") boost += 4;
      if (affinity === "sheltered") boost += 2;
      if (affinity === "outdoor") boost -= 3;
      break;
    case "windy_caution":
      if (affinity === "indoor") boost += 3;
      if (affinity === "sheltered") boost += 1;
      if (affinity === "outdoor") boost -= 2;
      break;
    case "cold_indoor":
      if (affinity === "indoor") boost += 4;
      if (affinity === "sheltered") boost += 1;
      if (affinity === "outdoor") boost -= 2;
      break;
    case "sunny_outdoor":
      if (affinity === "outdoor") boost += 3;
      if (affinity === "water") boost += 2;
      if (affinity === "indoor") boost -= 1;
      break;
    case "hot_mixed":
      if (affinity === "water") boost += 4;
      if (affinity === "indoor") boost += 2;
      if (affinity === "sheltered") boost += 1;
      if (affinity === "outdoor") boost -= 1;
      break;
    case "cloudy_mixed":
    default:
      if (affinity === "outdoor") boost += 1;
      if (affinity === "mixed") boost += 1;
      break;
  }

  if (context.timeOfDay === "evening" || context.timeOfDay === "night") {
    if (affinity === "indoor") boost += 1;
    if (affinity === "outdoor" && context.scenario !== "sunny_outdoor") boost -= 1;
  }

  if (context.timeOfDay === "morning" && context.scenario === "sunny_outdoor" && affinity === "outdoor") {
    boost += 1;
  }

  return boost;
}
