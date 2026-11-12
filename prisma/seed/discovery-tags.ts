/**
 * Initial editorial topic vocabulary. Safe additive seed: never overwrite an
 * editor's title, SEO settings, visibility, index policy, or existing article links.
 * Existing aliases/legacy tags are retained until reviewed with real DB usage.
 */
import type { PrismaClient } from "@prisma/client";

export const JOURNAL_DISCOVERY_TAGS = [
  {
    "title": "Новые места",
    "slug": "novye-mesta",
    "group": "PLACES",
    "sortOrder": 101
  },
  {
    "title": "Кафе с детьми",
    "slug": "kafe-s-detmi",
    "group": "PLACES",
    "sortOrder": 102
  },
  {
    "title": "Рестораны с детьми",
    "slug": "restorany-s-detmi",
    "group": "PLACES",
    "sortOrder": 103
  },
  {
    "title": "Игровые комнаты",
    "slug": "igrovye-komnaty",
    "group": "PLACES",
    "sortOrder": 104
  },
  {
    "title": "Парки",
    "slug": "parki",
    "group": "PLACES",
    "sortOrder": 105
  },
  {
    "title": "Экотропы",
    "slug": "ekotropy",
    "group": "PLACES",
    "sortOrder": 106
  },
  {
    "title": "Музеи",
    "slug": "muzei",
    "group": "PLACES",
    "sortOrder": 107
  },
  {
    "title": "Театры",
    "slug": "teatry",
    "group": "PLACES",
    "sortOrder": 108
  },
  {
    "title": "Зоопарки",
    "slug": "zooparki",
    "group": "PLACES",
    "sortOrder": 109
  },
  {
    "title": "Фермы",
    "slug": "fermy",
    "group": "PLACES",
    "sortOrder": 110
  },
  {
    "title": "Культура и искусство",
    "slug": "kultura-i-iskusstvo",
    "group": "ENTERTAINMENT",
    "sortOrder": 201
  },
  {
    "title": "Цирк и фокусы",
    "slug": "tsirk-i-fokusy",
    "group": "ENTERTAINMENT",
    "sortOrder": 202
  },
  {
    "title": "Выставки",
    "slug": "vystavki",
    "group": "ENTERTAINMENT",
    "sortOrder": 203
  },
  {
    "title": "Спектакли",
    "slug": "spektakli",
    "group": "ENTERTAINMENT",
    "sortOrder": 204
  },
  {
    "title": "Концерты",
    "slug": "kontserty",
    "group": "ENTERTAINMENT",
    "sortOrder": 205
  },
  {
    "title": "Квесты",
    "slug": "kvesty",
    "group": "ENTERTAINMENT",
    "sortOrder": 206
  },
  {
    "title": "Мастер-классы",
    "slug": "master-klassy",
    "group": "ENTERTAINMENT",
    "sortOrder": 207
  },
  {
    "title": "Научные шоу",
    "slug": "nauchnye-shou",
    "group": "ENTERTAINMENT",
    "sortOrder": 208
  },
  {
    "title": "Фестивали",
    "slug": "festivali",
    "group": "ENTERTAINMENT",
    "sortOrder": 209
  },
  {
    "title": "Активный отдых",
    "slug": "aktivnyy-otdykh",
    "group": "ENTERTAINMENT",
    "sortOrder": 210
  },
  {
    "title": "Животные",
    "slug": "zhivotnye",
    "group": "INTERESTS",
    "sortOrder": 301
  },
  {
    "title": "Наука",
    "slug": "nauka",
    "group": "INTERESTS",
    "sortOrder": 302
  },
  {
    "title": "Космос",
    "slug": "kosmos",
    "group": "INTERESTS",
    "sortOrder": 303
  },
  {
    "title": "Динозавры",
    "slug": "dinozavry",
    "group": "INTERESTS",
    "sortOrder": 304
  },
  {
    "title": "Техника и роботы",
    "slug": "tekhnika-i-roboty",
    "group": "INTERESTS",
    "sortOrder": 305
  },
  {
    "title": "Спорт",
    "slug": "sport",
    "group": "INTERESTS",
    "sortOrder": 306
  },
  {
    "title": "Творчество",
    "slug": "tvorchestvo",
    "group": "INTERESTS",
    "sortOrder": 307
  },
  {
    "title": "Музыка",
    "slug": "muzyka",
    "group": "INTERESTS",
    "sortOrder": 308
  },
  {
    "title": "Раннее развитие",
    "slug": "rannee-razvitie",
    "group": "DEVELOPMENT",
    "sortOrder": 401
  },
  {
    "title": "Подготовка к школе",
    "slug": "podgotovka-k-shkole",
    "group": "DEVELOPMENT",
    "sortOrder": 402
  },
  {
    "title": "Иностранные языки",
    "slug": "inostrannye-yazyki",
    "group": "DEVELOPMENT",
    "sortOrder": 403
  },
  {
    "title": "Танцы",
    "slug": "tantsy",
    "group": "DEVELOPMENT",
    "sortOrder": 404
  },
  {
    "title": "Детские книги",
    "slug": "detskie-knigi",
    "group": "DEVELOPMENT",
    "sortOrder": 405
  },
  {
    "title": "Чтение",
    "slug": "chtenie",
    "group": "DEVELOPMENT",
    "sortOrder": 406
  },
  {
    "title": "Обучение через игру",
    "slug": "obuchenie-cherez-igru",
    "group": "DEVELOPMENT",
    "sortOrder": 407
  },
  {
    "title": "День рождения",
    "slug": "den-rozhdeniya",
    "group": "CELEBRATIONS",
    "sortOrder": 501
  },
  {
    "title": "Сценарии праздников",
    "slug": "stsenarii-prazdnikov",
    "group": "CELEBRATIONS",
    "sortOrder": 502
  },
  {
    "title": "Аниматоры",
    "slug": "animatory",
    "group": "CELEBRATIONS",
    "sortOrder": 503
  },
  {
    "title": "Праздничный декор",
    "slug": "prazdnichnyy-dekor",
    "group": "CELEBRATIONS",
    "sortOrder": 504
  },
  {
    "title": "Торты и десерты",
    "slug": "torty-i-deserty",
    "group": "CELEBRATIONS",
    "sortOrder": 505
  },
  {
    "title": "Новый год",
    "slug": "novyy-god",
    "group": "CELEBRATIONS",
    "sortOrder": 506
  },
  {
    "title": "Выпускной",
    "slug": "vypusknoy",
    "group": "CELEBRATIONS",
    "sortOrder": 507
  },
  {
    "title": "Семейные традиции",
    "slug": "semeynye-traditsii",
    "group": "CELEBRATIONS",
    "sortOrder": 508
  },
  {
    "title": "Воспитание",
    "slug": "vospitanie",
    "group": "FAMILY",
    "sortOrder": 601
  },
  {
    "title": "Красота и стиль",
    "slug": "krasota-i-stil",
    "group": "FAMILY",
    "sortOrder": 602
  },
  {
    "title": "Время для себя",
    "slug": "vremya-dlya-sebya",
    "group": "FAMILY",
    "sortOrder": 603
  },
  {
    "title": "Семейная психология",
    "slug": "semeynaya-psikhologiya",
    "group": "FAMILY",
    "sortOrder": 604
  },
  {
    "title": "Семейный досуг",
    "slug": "semeynyy-dosug",
    "group": "FAMILY",
    "sortOrder": 605
  },
  {
    "title": "Идеи для дома",
    "slug": "idei-dlya-doma",
    "group": "FAMILY",
    "sortOrder": 606
  },
  {
    "title": "Совместное творчество",
    "slug": "sovmestnoe-tvorchestvo",
    "group": "FAMILY",
    "sortOrder": 607
  },
  {
    "title": "Путешествия с детьми",
    "slug": "puteshestviya-s-detmi",
    "group": "TRAVEL",
    "sortOrder": 701
  },
  {
    "title": "По Беларуси",
    "slug": "po-belarusi",
    "group": "TRAVEL",
    "sortOrder": 702
  },
  {
    "title": "Поездки на выходные",
    "slug": "poezdki-na-vykhodnye",
    "group": "TRAVEL",
    "sortOrder": 703
  },
  {
    "title": "Автопутешествия",
    "slug": "avtoputeshestviya",
    "group": "TRAVEL",
    "sortOrder": 704
  },
  {
    "title": "Семейные отели",
    "slug": "semeynye-oteli",
    "group": "TRAVEL",
    "sortOrder": 705
  },
  {
    "title": "Загородный отдых",
    "slug": "zagorodnyy-otdykh",
    "group": "TRAVEL",
    "sortOrder": 706
  },
  {
    "title": "Отдых на природе",
    "slug": "otdykh-na-prirode",
    "group": "TRAVEL",
    "sortOrder": 707
  }
] as const;

export async function seedDiscoveryTags(prisma: PrismaClient) {
  const existing = await prisma.discoveryTag.findMany({ select: { slug: true, title: true } });
  const knownSlugs = new Set(existing.map(tag => tag.slug));
  const knownTitles = new Set(existing.map(tag => tag.title.trim().toLocaleLowerCase("ru")));
  const missing = JOURNAL_DISCOVERY_TAGS.filter(tag =>
    !knownSlugs.has(tag.slug) && !knownTitles.has(tag.title.toLocaleLowerCase("ru"))
  );
  if (missing.length) {
    await prisma.discoveryTag.createMany({ data: missing.map(tag => ({ ...tag, reviewStatus: "APPROVED" as const, indexingMode: "AUTO" as const })), skipDuplicates: true });
  }
  console.log(`  → Discovery Tags: ${missing.length} new, ${existing.length} existing preserved`);
}
