/**
 * prisma/seed/event-categories.ts
 * 
 * Seed для категорий и жанров событий (Event).
 * Категории имеют publicationType = EVENT.
 * Структура: 1 категория + несколько жанров (строго внутри категории).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface EventGenre {
  nameRu: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
}

interface EventCategoryData {
  nameRu: string;
  nameEn: string;
  slug: string;
  icon?: string;
  sortOrder: number;
  genres: EventGenre[];
}

const EVENT_CATEGORIES: EventCategoryData[] = [
  {
    nameRu: "Спектакли",
    nameEn: "Theatre",
    slug: "theatre",
    icon: "🎭",
    sortOrder: 10,
    genres: [
      { nameRu: "Кукольный", nameEn: "Puppet", slug: "puppet", sortOrder: 10 },
      { nameRu: "Музыкальный", nameEn: "Musical", slug: "musical", sortOrder: 20 },
      { nameRu: "Интерактивный", nameEn: "Interactive", slug: "interactive", sortOrder: 30 },
      { nameRu: "Иммерсивный", nameEn: "Immersive", slug: "immersive", sortOrder: 40 },
      { nameRu: "Театр теней", nameEn: "Shadow Theatre", slug: "shadow-theatre", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Мастер-классы",
    nameEn: "Workshops",
    slug: "workshops",
    icon: "🎨",
    sortOrder: 20,
    genres: [
      { nameRu: "Творческий", nameEn: "Creative", slug: "creative", sortOrder: 10 },
      { nameRu: "Кулинарный", nameEn: "Cooking", slug: "cooking", sortOrder: 20 },
      { nameRu: "Научный", nameEn: "Science", slug: "science", sortOrder: 30 },
      { nameRu: "Ремесленный", nameEn: "Craft", slug: "craft", sortOrder: 40 },
      { nameRu: "IT и технологии", nameEn: "IT and Tech", slug: "it-tech", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Праздники и фестивали",
    nameEn: "Festivals",
    slug: "festivals",
    icon: "🎉",
    sortOrder: 30,
    genres: [
      { nameRu: "Городской праздник", nameEn: "City Festival", slug: "city-festival", sortOrder: 10 },
      { nameRu: "Семейный фестиваль", nameEn: "Family Festival", slug: "family-festival", sortOrder: 20 },
      { nameRu: "Сезонный", nameEn: "Seasonal", slug: "seasonal", sortOrder: 30 },
      { nameRu: "Ярмарка", nameEn: "Fair", slug: "fair", sortOrder: 40 },
      { nameRu: "Тематический праздник", nameEn: "Themed Party", slug: "themed-party", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Концерты и шоу",
    nameEn: "Shows",
    slug: "shows",
    icon: "🎤",
    sortOrder: 40,
    genres: [
      { nameRu: "Детский концерт", nameEn: "Kids Concert", slug: "kids-concert", sortOrder: 10 },
      { nameRu: "Музыкальное шоу", nameEn: "Music Show", slug: "music-show", sortOrder: 20 },
      { nameRu: "Цирковое шоу", nameEn: "Circus Show", slug: "circus-show", sortOrder: 30 },
      { nameRu: "Научное шоу", nameEn: "Science Show", slug: "science-show", sortOrder: 40 },
      { nameRu: "Ледовое шоу", nameEn: "Ice Show", slug: "ice-show", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Экскурсии и программы",
    nameEn: "Excursions",
    slug: "excursions",
    icon: "🗺️",
    sortOrder: 50,
    genres: [
      { nameRu: "Музейная программа", nameEn: "Museum Program", slug: "museum-program", sortOrder: 10 },
      { nameRu: "Городская экскурсия", nameEn: "City Tour", slug: "city-tour", sortOrder: 20 },
      { nameRu: "Природная экскурсия", nameEn: "Nature Tour", slug: "nature-tour", sortOrder: 30 },
      { nameRu: "Образовательная программа", nameEn: "Educational Program", slug: "educational-program", sortOrder: 40 },
      { nameRu: "Квест-экскурсия", nameEn: "Quest Tour", slug: "quest-tour", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Спортивные события",
    nameEn: "Sports Events",
    slug: "sports-events",
    icon: "⚽",
    sortOrder: 60,
    genres: [
      { nameRu: "Соревнование", nameEn: "Competition", slug: "competition", sortOrder: 10 },
      { nameRu: "Турнир", nameEn: "Tournament", slug: "tournament", sortOrder: 20 },
      { nameRu: "Открытая тренировка", nameEn: "Open Training", slug: "open-training", sortOrder: 30 },
      { nameRu: "Забег", nameEn: "Race", slug: "race", sortOrder: 40 },
      { nameRu: "Семейный спорт", nameEn: "Family Sport", slug: "family-sport", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Выставки и экспозиции",
    nameEn: "Exhibitions",
    slug: "exhibitions",
    icon: "🖼️",
    sortOrder: 70,
    genres: [
      { nameRu: "Интерактивная выставка", nameEn: "Interactive Exhibition", slug: "interactive-exhibition", sortOrder: 10 },
      { nameRu: "Художественная выставка", nameEn: "Art Exhibition", slug: "art-exhibition", sortOrder: 20 },
      { nameRu: "Научная экспозиция", nameEn: "Science Exhibition", slug: "science-exhibition", sortOrder: 30 },
      { nameRu: "Историческая экспозиция", nameEn: "History Exhibition", slug: "history-exhibition", sortOrder: 40 },
      { nameRu: "Детская выставка", nameEn: "Kids Exhibition", slug: "kids-exhibition", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Игровые программы",
    nameEn: "Play Programs",
    slug: "play-programs",
    icon: "🎮",
    sortOrder: 80,
    genres: [
      { nameRu: "Квест", nameEn: "Quest", slug: "quest", sortOrder: 10 },
      { nameRu: "Анимационная программа", nameEn: "Animation", slug: "animation", sortOrder: 20 },
      { nameRu: "Настольные игры", nameEn: "Board Games", slug: "board-games", sortOrder: 30 },
      { nameRu: "Активные игры", nameEn: "Active Games", slug: "active-games", sortOrder: 40 },
      { nameRu: "Ролевые игры", nameEn: "Role Play", slug: "role-play", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Образовательные занятия",
    nameEn: "Classes",
    slug: "classes",
    icon: "📚",
    sortOrder: 90,
    genres: [
      { nameRu: "Развивающее занятие", nameEn: "Development Class", slug: "development-class", sortOrder: 10 },
      { nameRu: "Языковое занятие", nameEn: "Language Class", slug: "language-class", sortOrder: 20 },
      { nameRu: "Подготовка к школе", nameEn: "Preschool Prep", slug: "preschool-prep", sortOrder: 30 },
      { nameRu: "Лекция для детей", nameEn: "Kids Lecture", slug: "kids-lecture", sortOrder: 40 },
      { nameRu: "Практикум", nameEn: "Practical Class", slug: "practical-class", sortOrder: 50 },
    ],
  },
  {
    nameRu: "Киберспорт и игры",
    nameEn: "Esports",
    slug: "esports",
    icon: "🕹️",
    sortOrder: 100,
    genres: [
      { nameRu: "Киберспортивный турнир", nameEn: "Esports Tournament", slug: "esports-tournament", sortOrder: 10 },
      { nameRu: "Игровое мероприятие", nameEn: "Gaming Event", slug: "gaming-event", sortOrder: 20 },
      { nameRu: "LAN-турнир", nameEn: "LAN Tournament", slug: "lan", sortOrder: 30 },
      { nameRu: "Консольные игры", nameEn: "Console Gaming", slug: "console-gaming", sortOrder: 40 },
      { nameRu: "VR-игры", nameEn: "VR Gaming", slug: "vr-gaming", sortOrder: 50 },
    ],
  },
];

export async function seedEventCategories() {
  console.log("  → Event Categories");

  for (const cat of EVENT_CATEGORIES) {
    // Создаем основную категорию
    const parent = await prisma.eventCategory.upsert({
      where: { publicationType_slug: { publicationType: "EVENT", slug: cat.slug } },
      update: {
        nameRu: cat.nameRu,
        nameEn: cat.nameEn,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isActive: true,
        parentId: null,
      },
      create: {
        slug: cat.slug,
        nameRu: cat.nameRu,
        nameEn: cat.nameEn,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        publicationType: "EVENT",
        isActive: true,
        parentId: null,
      },
    });

    // Создаем жанры (Genre) для этой категории
    for (const genre of cat.genres) {
      await prisma.genre.upsert({
        where: { categoryId_slug: { categoryId: parent.id, slug: genre.slug } },
        update: {
          name: genre.nameRu,
          sortOrder: genre.sortOrder,
          isActive: true,
        },
        create: {
          categoryId: parent.id,
          slug: genre.slug,
          name: genre.nameRu,
          sortOrder: genre.sortOrder,
          isActive: true,
        },
      });
    }

    console.log(`    ✓ ${cat.nameRu} (${cat.genres.length} жанров)`);
  }
}

// Для прямого запуска: pnpm tsx prisma/seed/event-categories.ts
if (require.main === module) {
  seedEventCategories()
    .then(async () => {
      console.log("✅ Event categories seed complete.");
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
