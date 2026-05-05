/**
 * prisma/seed/place-categories.ts
 * 
 * Seed для категорий и подкатегорий мест (Place).
 * Категории имеют publicationType = PLACE.
 * Структура: 1 основная категория + 1-3 подкатегории.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PlaceCategory {
  slug: string;
  nameRu: string;
  nameEn: string;
  icon?: string;
  sortOrder: number;
  subcategories: Array<{
    slug: string;
    nameRu: string;
    nameEn: string;
    sortOrder: number;
  }>;
}

const PLACE_CATEGORIES: PlaceCategory[] = [
  {
    slug: "education",
    nameRu: "Образование и развитие",
    nameEn: "Education and Development",
    icon: "📚",
    sortOrder: 10,
    subcategories: [
      { slug: "it-schools", nameRu: "IT школы", nameEn: "IT Schools", sortOrder: 10 },
      { slug: "kindergartens", nameRu: "Детские сады", nameEn: "Kindergartens", sortOrder: 20 },
      { slug: "development-centers", nameRu: "Центры развития", nameEn: "Development Centers", sortOrder: 30 },
      { slug: "preschool-prep", nameRu: "Подготовка к школе", nameEn: "Preschool Preparation", sortOrder: 40 },
      { slug: "language-schools", nameRu: "Языковые школы", nameEn: "Language Schools", sortOrder: 50 },
      { slug: "music-schools", nameRu: "Музыкальные школы", nameEn: "Music Schools", sortOrder: 60 },
      { slug: "art-schools", nameRu: "Школы искусств", nameEn: "Art Schools", sortOrder: 70 },
      { slug: "dance-schools", nameRu: "Танцевальные школы", nameEn: "Dance Schools", sortOrder: 80 },
      { slug: "theatre-studios", nameRu: "Театральные студии", nameEn: "Theatre Studios", sortOrder: 90 },
      { slug: "chess-schools", nameRu: "Шахматные школы", nameEn: "Chess Schools", sortOrder: 100 },
      { slug: "tutors", nameRu: "Репетиторы", nameEn: "Tutors", sortOrder: 110 },
      { slug: "private-schools", nameRu: "Частные школы", nameEn: "Private Schools", sortOrder: 120 },
    ],
  },
  {
    slug: "entertainment",
    nameRu: "Развлечения и досуг",
    nameEn: "Entertainment and Leisure",
    icon: "🎪",
    sortOrder: 20,
    subcategories: [
      { slug: "playrooms", nameRu: "Детские игровые комнаты", nameEn: "Playrooms", sortOrder: 10 },
      { slug: "kids-entertainment-centers", nameRu: "Детские развлекательные центры", nameEn: "Kids Entertainment Centers", sortOrder: 20 },
      { slug: "trampoline-parks", nameRu: "Батутные центры", nameEn: "Trampoline Parks", sortOrder: 30 },
      { slug: "water-parks", nameRu: "Аквапарки", nameEn: "Water Parks", sortOrder: 40 },
      { slug: "zoos", nameRu: "Зоопарки", nameEn: "Zoos", sortOrder: 50 },
      { slug: "cinemas", nameRu: "Кинотеатры", nameEn: "Cinemas", sortOrder: 60 },
      { slug: "quests", nameRu: "Квесты", nameEn: "Quests", sortOrder: 70 },
      { slug: "museums-galleries", nameRu: "Музеи и галереи", nameEn: "Museums and Galleries", sortOrder: 80 },
      { slug: "planetariums", nameRu: "Планетарии", nameEn: "Planetariums", sortOrder: 90 },
      { slug: "circuses", nameRu: "Цирки", nameEn: "Circuses", sortOrder: 100 },
      { slug: "horse-riding-clubs", nameRu: "Конные клубы", nameEn: "Horse Riding Clubs", sortOrder: 110 },
    ],
  },
  {
    slug: "outdoor",
    nameRu: "Парки и активный отдых",
    nameEn: "Parks and Outdoor Activities",
    icon: "🌳",
    sortOrder: 30,
    subcategories: [
      { slug: "parks-playgrounds", nameRu: "Парки и площадки", nameEn: "Parks and Playgrounds", sortOrder: 10 },
      { slug: "adventure-parks", nameRu: "Парки активного отдыха", nameEn: "Adventure Parks", sortOrder: 20 },
      { slug: "rentals", nameRu: "Точки проката", nameEn: "Rentals", sortOrder: 30 },
    ],
  },
  {
    slug: "countryside",
    nameRu: "Загородный отдых",
    nameEn: "Countryside Recreation",
    icon: "🏡",
    sortOrder: 40,
    subcategories: [
      { slug: "sanatoriums", nameRu: "Санатории", nameEn: "Sanatoriums", sortOrder: 10 },
      { slug: "recreation-bases", nameRu: "Базы отдыха", nameEn: "Recreation Bases", sortOrder: 20 },
      { slug: "estates", nameRu: "Усадьбы", nameEn: "Estates", sortOrder: 30 },
      { slug: "agro-estates", nameRu: "Агроусадьбы", nameEn: "Agro Estates", sortOrder: 40 },
      { slug: "baths", nameRu: "Бани", nameEn: "Baths", sortOrder: 50 },
    ],
  },
  {
    slug: "sport",
    nameRu: "Спорт",
    nameEn: "Sports",
    icon: "⚽",
    sortOrder: 50,
    subcategories: [
      { slug: "swimming-pools", nameRu: "Бассейны", nameEn: "Swimming Pools", sortOrder: 10 },
      { slug: "swimming", nameRu: "Плавание", nameEn: "Swimming", sortOrder: 20 },
      { slug: "football", nameRu: "Футбол", nameEn: "Football", sortOrder: 30 },
      { slug: "basketball", nameRu: "Баскетбол", nameEn: "Basketball", sortOrder: 40 },
      { slug: "volleyball", nameRu: "Волейбол", nameEn: "Volleyball", sortOrder: 50 },
      { slug: "martial-arts", nameRu: "Единоборства", nameEn: "Martial Arts", sortOrder: 60 },
      { slug: "gymnastics-athletics", nameRu: "Гимнастика и лёгкая атлетика", nameEn: "Gymnastics and Athletics", sortOrder: 70 },
      { slug: "figure-skating", nameRu: "Фигурное катание", nameEn: "Figure Skating", sortOrder: 80 },
      { slug: "hockey", nameRu: "Хоккей", nameEn: "Hockey", sortOrder: 90 },
      { slug: "tennis", nameRu: "Теннис", nameEn: "Tennis", sortOrder: 100 },
      { slug: "climbing", nameRu: "Скалолазание", nameEn: "Climbing", sortOrder: 110 },
      { slug: "fitness-yoga", nameRu: "Фитнес и йога", nameEn: "Fitness and Yoga", sortOrder: 120 },
    ],
  },
  {
    slug: "food",
    nameRu: "Кафе и еда",
    nameEn: "Cafes and Food",
    icon: "🍰",
    sortOrder: 60,
    subcategories: [
      { slug: "kids-cafes", nameRu: "Детские кафе", nameEn: "Kids Cafes", sortOrder: 10 },
      { slug: "restaurants-with-playroom", nameRu: "Рестораны с детской комнатой", nameEn: "Restaurants with Playroom", sortOrder: 20 },
      { slug: "delivery-services", nameRu: "Службы доставки", nameEn: "Delivery Services", sortOrder: 30 },
      { slug: "catering", nameRu: "Кейтеринг", nameEn: "Catering", sortOrder: 40 },
      { slug: "custom-cakes-sweets", nameRu: "Торты и сладости на заказ", nameEn: "Custom Cakes and Sweets", sortOrder: 50 },
    ],
  },
  {
    slug: "health",
    nameRu: "Здоровье",
    nameEn: "Health",
    icon: "🏥",
    sortOrder: 70,
    subcategories: [
      { slug: "medical-centers", nameRu: "Медицинские центры", nameEn: "Medical Centers", sortOrder: 10 },
      { slug: "pediatricians", nameRu: "Педиатры", nameEn: "Pediatricians", sortOrder: 20 },
      { slug: "pediatric-dentistry", nameRu: "Детские стоматологии", nameEn: "Pediatric Dentistry", sortOrder: 30 },
      { slug: "speech-therapists", nameRu: "Логопеды и дефектологи", nameEn: "Speech Therapists", sortOrder: 40 },
      { slug: "psychologists", nameRu: "Психологи", nameEn: "Psychologists", sortOrder: 50 },
      { slug: "diagnostics", nameRu: "Анализы и диагностика", nameEn: "Diagnostics", sortOrder: 60 },
      { slug: "ultrasound", nameRu: "УЗИ", nameEn: "Ultrasound", sortOrder: 70 },
      { slug: "kids-physical-therapy", nameRu: "ЛФК для детей", nameEn: "Kids Physical Therapy", sortOrder: 80 },
    ],
  },
  {
    slug: "shopping",
    nameRu: "Товары и магазины",
    nameEn: "Shopping",
    icon: "🛍️",
    sortOrder: 80,
    subcategories: [
      { slug: "toy-stores", nameRu: "Магазины игрушек", nameEn: "Toy Stores", sortOrder: 10 },
      { slug: "kids-clothing", nameRu: "Детская одежда", nameEn: "Kids Clothing", sortOrder: 20 },
      { slug: "kids-shoes", nameRu: "Детская обувь", nameEn: "Kids Shoes", sortOrder: 30 },
      { slug: "strollers-car-seats", nameRu: "Коляски и автокресла", nameEn: "Strollers and Car Seats", sortOrder: 40 },
      { slug: "kids-books", nameRu: "Детские книги", nameEn: "Kids Books", sortOrder: 50 },
      { slug: "baby-food", nameRu: "Детское питание", nameEn: "Baby Food", sortOrder: 60 },
      { slug: "creative-supplies", nameRu: "Товары для творчества", nameEn: "Creative Supplies", sortOrder: 70 },
      { slug: "mom-products", nameRu: "Товары для мам", nameEn: "Mom Products", sortOrder: 80 },
    ],
  },
  {
    slug: "family-services",
    nameRu: "Услуги для семьи",
    nameEn: "Family Services",
    icon: "👨‍👩‍👧‍👦",
    sortOrder: 90,
    subcategories: [
      { slug: "photo-studios", nameRu: "Фотостудии", nameEn: "Photo Studios", sortOrder: 10 },
      { slug: "photography", nameRu: "Фотосъёмка", nameEn: "Photography", sortOrder: 20 },
      { slug: "kids-beauty-salons", nameRu: "Детские салоны красоты", nameEn: "Kids Beauty Salons", sortOrder: 30 },
      { slug: "family-beauty-salons", nameRu: "Семейные салоны красоты", nameEn: "Family Beauty Salons", sortOrder: 40 },
      { slug: "kids-goods-rental", nameRu: "Прокат детских товаров", nameEn: "Kids Goods Rental", sortOrder: 50 },
      { slug: "babysitting-agencies", nameRu: "Детский персонал и няни", nameEn: "Babysitting Agencies", sortOrder: 60 },
      { slug: "spa-centers", nameRu: "СПА-центры", nameEn: "SPA Centers", sortOrder: 70 },
    ],
  },
  {
    slug: "pregnancy",
    nameRu: "Беременность",
    nameEn: "Pregnancy",
    icon: "🤰",
    sortOrder: 100,
    subcategories: [
      { slug: "pregnancy-courses", nameRu: "Курсы для беременных", nameEn: "Pregnancy Courses", sortOrder: 10 },
      { slug: "prenatal-yoga", nameRu: "Йога для беременных", nameEn: "Prenatal Yoga", sortOrder: 20 },
      { slug: "pregnancy-care", nameRu: "Ведение беременности", nameEn: "Pregnancy Care", sortOrder: 30 },
      { slug: "maternity-hospitals", nameRu: "Роддома", nameEn: "Maternity Hospitals", sortOrder: 40 },
      { slug: "maternity-stores", nameRu: "Магазины для беременных", nameEn: "Maternity Stores", sortOrder: 50 },
      { slug: "prenatal-massage", nameRu: "Массаж для беременных", nameEn: "Prenatal Massage", sortOrder: 60 },
    ],
  },
];

export async function seedPlaceCategories() {
  console.log("  → Place Categories");

  for (const cat of PLACE_CATEGORIES) {
    // Создаем основную категорию
    const parent = await prisma.eventCategory.upsert({
      where: { publicationType_slug: { publicationType: "PLACE", slug: cat.slug } },
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
        publicationType: "PLACE",
        isActive: true,
        parentId: null,
      },
    });

    // Создаем подкатегории
    for (const sub of cat.subcategories) {
      await prisma.eventCategory.upsert({
        where: { publicationType_slug: { publicationType: "PLACE", slug: sub.slug } },
        update: {
          nameRu: sub.nameRu,
          nameEn: sub.nameEn,
          sortOrder: sub.sortOrder,
          isActive: true,
          parentId: parent.id,
        },
        create: {
          slug: sub.slug,
          nameRu: sub.nameRu,
          nameEn: sub.nameEn,
          sortOrder: sub.sortOrder,
          publicationType: "PLACE",
          isActive: true,
          parentId: parent.id,
        },
      });
    }

    console.log(`    ✓ ${cat.nameRu} (${cat.subcategories.length} подкатегорий)`);
  }
}

// Для прямого запуска: pnpm tsx prisma/seed/place-categories.ts
if (require.main === module) {
  seedPlaceCategories()
    .then(async () => {
      console.log("✅ Place categories seed complete.");
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
