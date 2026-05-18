/**
 * Offer Page Mock Data
 * Примеры данных для тестирования и разработки
 */

import type { OfferPageData } from "./offerPageTypes";

/**
 * Mock: Регулярные занятия (REGULAR)
 */
export const mockRegularOffer: OfferPageData = {
  id: "offer-1",
  slug: "robotics-for-kids",
  citySlug: "minsk",
  title: "Робототехника для детей",
  shortDescription: "Научим создавать и программировать роботов. Развиваем логику, креативность и инженерное мышление.",
  description: `
    <h3>О курсе</h3>
    <p>Курс робототехники для детей 7-12 лет. Занятия проходят в небольших группах до 8 человек.</p>
    
    <h3>Что будем делать</h3>
    <ul>
      <li>Собирать роботов из конструктора LEGO Mindstorms</li>
      <li>Программировать на визуальном языке</li>
      <li>Участвовать в соревнованиях</li>
      <li>Работать в команде над проектами</li>
    </ul>
    
    <h3>Преимущества</h3>
    <ul>
      <li>Опытные преподаватели с инженерным образованием</li>
      <li>Современное оборудование</li>
      <li>Индивидуальный подход к каждому ребёнку</li>
      <li>Сертификат по окончании курса</li>
    </ul>
  `,
  offerType: "REGULAR",
  
  media: {
    posterUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200",
    posterAlt: "Дети собирают роботов",
    gallery: [
      {
        id: "1",
        url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
        alt: "Занятие робототехникой",
      },
      {
        id: "2",
        url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800",
        alt: "Робот LEGO",
      },
      {
        id: "3",
        url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
        alt: "Программирование",
      },
      {
        id: "4",
        url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800",
        alt: "Соревнования",
      },
    ],
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoThumbnail: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
    videoDuration: "3:45",
    videoLabel: "Как проходят занятия",
  },
  
  metaGrid: [
    { id: "1", icon: "age", label: "Возраст", value: "7-12 лет" },
    { id: "2", icon: "duration", label: "Длительность", value: "1.5 часа" },
    { id: "3", icon: "format", label: "Формат", value: "Группа до 8 человек" },
    { id: "4", icon: "level", label: "Уровень", value: "Начальный" },
    { id: "5", icon: "schedule", label: "Расписание", value: "2 раза в неделю" },
  ],
  
  pricing: {
    mode: "multiple",
    priceFrom: "120 BYN",
    options: [
      {
        id: "1",
        title: "Пробное занятие",
        price: "15 BYN",
        description: "Одно занятие для знакомства",
      },
      {
        id: "2",
        title: "Абонемент на месяц",
        price: "120 BYN",
        oldPrice: "140 BYN",
        description: "8 занятий, 2 раза в неделю",
      },
      {
        id: "3",
        title: "Абонемент на 3 месяца",
        price: "330 BYN",
        oldPrice: "420 BYN",
        description: "24 занятия, выгода 90 BYN",
      },
    ],
    promotionText: "Скидка 20% на первый месяц",
    promotionSubtitle: "При оплате до конца недели",
  },
  
  schedule: {
    type: "classes",
    items: [
      {
        id: "1",
        groupName: "Младшая группа (7-9 лет)",
        days: "Пн, Ср",
        time: "16:00 - 17:30",
        price: "120 BYN/мес",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
      {
        id: "2",
        groupName: "Средняя группа (10-12 лет)",
        days: "Вт, Чт",
        time: "17:00 - 18:30",
        price: "120 BYN/мес",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
      {
        id: "3",
        groupName: "Выходная группа",
        days: "Сб",
        time: "11:00 - 12:30",
        price: "140 BYN/мес",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
    ],
  },
  
  place: {
    id: "place-1",
    name: "Центр робототехники RoboKids",
    slug: "robokids-center",
    address: "ул. Притыцкого, 62",
    district: "Московский район",
    metro: "Площадь Победы",
    lat: 53.9045,
    lng: 27.5615,
  },
  
  reviews: [
    {
      id: "1",
      authorName: "Анна Петрова",
      rating: 5,
      text: "Отличные занятия! Сын ходит уже полгода, очень доволен. Преподаватели профессиональные, умеют заинтересовать детей.",
      date: "15 апреля 2026",
      helpful: 12,
    },
    {
      id: "2",
      authorName: "Дмитрий Иванов",
      rating: 5,
      text: "Ребёнок в восторге от занятий. Научился программировать, собирать сложные конструкции. Рекомендую!",
      date: "10 апреля 2026",
      helpful: 8,
    },
    {
      id: "3",
      authorName: "Елена Сидорова",
      rating: 4,
      text: "Хороший центр, качественное оборудование. Единственный минус - иногда бывает сложно записаться в удобное время.",
      date: "5 апреля 2026",
      helpful: 5,
    },
  ],
  reviewsCount: 47,
  averageRating: 4.8,
  
  cta: {
    type: "записаться",
    primaryLabel: "Записаться на занятие",
    secondaryLabel: "В план",
    phone: "+375 29 123 45 67",
    instructions: "Позвоните или оставьте заявку, мы перезвоним в течение часа",
  },
  
  similar: [
    {
      id: "offer-2",
      title: "Программирование для детей",
      slug: "programming-for-kids",
      coverUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400",
      priceLabel: "от 100 BYN",
      ageLabel: "8-14 лет",
      placeTitle: "IT-школа KidsCode",
      rating: 4.9,
      reviewsCount: 32,
    },
    {
      id: "offer-3",
      title: "3D-моделирование",
      slug: "3d-modeling",
      coverUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400",
      priceLabel: "от 110 BYN",
      ageLabel: "10-16 лет",
      placeTitle: "Центр творчества",
      rating: 4.7,
      reviewsCount: 28,
    },
  ],
  
  seo: {
    title: "Робототехника для детей в Минске | RoboKids",
    description: "Курсы робототехники для детей 7-12 лет. Научим создавать и программировать роботов. Занятия в небольших группах. Запись открыта!",
    ogTitle: "Робототехника для детей | RoboKids",
    ogDescription: "Научим создавать и программировать роботов. Развиваем логику и инженерное мышление.",
    ogImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200",
  },
  
  discoveryIntent: undefined,
};

/**
 * Mock: Rich summer camp with all design fields populated.
 * Use ?mock=1 on any offer page to render this.
 */
export const mockSummerCamp: OfferPageData = {
  id: "mock-summer-camp-2026",
  slug: "letni-lager-priklyucheniya",
  citySlug: "minsk",
  title: "Летний лагерь «Бизнес-старт»",
  shortDescription: "Незабываемое лето на природе! Предпринимательство, командные игры, спорт и творчество — всё в одном месте.",
  description: `
    <h3>О лагере</h3>
    <p>Летний лагерь для детей 10–16 лет на берегу озера Нарочь. Программа сочетает активный отдых, творчество и погружение в мир предпринимательства.</p>

    <h3>Программа смены</h3>
    <ul>
      <li>Командные бизнес-игры и стартап-конкурсы</li>
      <li>Спортивные соревнования и туристические походы</li>
      <li>Творческие мастер-классы: кино, музыка, арт</li>
      <li>Вечерние дискотеки, квесты и костры</li>
      <li>Купание в озере под присмотром инструктора</li>
    </ul>

    <h3>Почему выбирают нас</h3>
    <ul>
      <li>Опытные вожатые и наставники-предприниматели</li>
      <li>Безопасная территория с круглосуточной охраной</li>
      <li>5-разовое питание с учётом аллергий</li>
      <li>Медицинское сопровождение 24/7</li>
      <li>Сертификат участника по итогам смены</li>
    </ul>
  `,
  offerType: "CAMP",

  media: {
    posterUrl: "/api/media/file/1778498051305-xpoa8m42ctj-bs2.webp",
    posterAlt: "Летний лагерь Бизнес-старт",
    gallery: [
      { id: "g1", url: "/api/media/file/1778498064791-dwfqkyigbxv-bs1.webp", alt: "Территория лагеря" },
      { id: "g2", url: "/api/media/file/1778498065577-0a62bvcwnth-bs3.webp", alt: "Спортивные игры" },
      { id: "g3", url: "/api/media/file/1778498066307-tuwzpz47qt-bs4.webp", alt: "Вечерние мероприятия" },
    ],
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoThumbnail: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800",
    videoDuration: "2:18",
    videoLabel: "Трейлер лагеря",
  },

  metaGrid: [
    { id: "age", label: "Возраст", value: "10–16 лет" },
    { id: "duration", label: "Длительность", value: "14 дней" },
    { id: "format", label: "Формат", value: "Выездной лагерь" },
    { id: "location", label: "Место", value: "Озеро Нарочь" },
  ],

  pricing: {
    mode: "single",
    priceFrom: "850 BYN",
    oldPrice: "944 BYN",
    priceCaption: "/ смена",
    promotionText: "Раннее бронирование -10%",
    promotionSubtitle: "При оплате до 1 мая",
    promoTitle: "-10% до конца мая",
    promoUntil: "2026-05-31T23:59:59.000Z",
    promotionDetails: `<ul><li><strong>-10%</strong> на второго члена семьи (кровные узы)</li><li><strong>-15%</strong> приведи друга, который запишется</li><li><strong>-10%</strong> ранняя запись до 31 мая 2026</li></ul>`,
  },

  schedule: {
    type: "shifts",
    items: [
      {
        id: "shift-1",
        title: "Первая смена",
        dateFrom: "01.06.2026",
        dateTo: "14.06.2026",
        duration: "14 дней",
        ageRange: "10–16 лет",
        spotsLeft: 3,
        capacity: 30,
        price: "850 BYN",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
      {
        id: "shift-2",
        title: "Вторая смена",
        dateFrom: "16.06.2026",
        dateTo: "29.06.2026",
        duration: "14 дней",
        ageRange: "10–16 лет",
        spotsLeft: 12,
        capacity: 30,
        price: "765 BYN",
        oldPrice: "944 BYN",
        promoLabel: "HOT · -10% ДО 31.05",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
      {
        id: "shift-3",
        title: "Третья смена",
        dateFrom: "01.07.2026",
        dateTo: "14.07.2026",
        duration: "14 дней",
        ageRange: "10–16 лет",
        spotsLeft: 22,
        capacity: 30,
        price: "850 BYN",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
    ],
  },

  accommodation: {
    provided: true,
    type: "База отдыха",
    address: "Озеро Нарочь, база отдыха «Лесная»",
    rooms: "Комнаты по 4–6 человек с удобствами",
    conditions: "Душ, туалет, Wi-Fi в общих зонах",
    mealInfo: "5-разовое питание, учитываем аллергии и предпочтения",
    transferInfo: "Организованный трансфер из Минска (включён в стоимость)",
    whatToBring: "Удобная одежда и обувь, купальник, средства гигиены, головной убор",
    safetyInfo: "Территория огорожена и охраняется. Купание только под присмотром инструкторов.",
    medicalInfo: "Медпункт на территории, врач 24/7. Необходима справка о здоровье.",
  },

  place: {
    id: "place-camp-mock",
    name: "База отдыха «Лесная»",
    slug: "lesnaya-base",
    address: "Мядельский р-н, п. Нарочь, ул. Лесная, 7",
    district: "Мядельский район",
    metro: undefined,
    lat: 54.8667,
    lng: 26.7333,
    logoUrl: undefined,
    rating: 4.6,
    ratingsCount: 22,
  },

  reviews: [
    {
      id: "r1",
      authorName: "Ольга Михайлова",
      rating: 5,
      text: "Ребёнок вернулся счастливый и загорелый! Отличная организация, внимательные вожатые. Обязательно поедем ещё в следующем году.",
      date: "20 июля 2025",
    },
    {
      id: "r2",
      authorName: "Сергей Волков",
      rating: 5,
      text: "Лучший лагерь! Дочь в восторге, нашла новых друзей. Программа насыщенная, скучать некогда. Бизнес-игры оказались настоящим хитом.",
      date: "15 июля 2025",
    },
    {
      id: "r3",
      authorName: "Марина Козлова",
      rating: 4,
      text: "Хороший лагерь, дети были под хорошим присмотром. Питание понравилось всем. Единственное — хотелось бы больше интернета для связи с ребёнком.",
      date: "5 августа 2025",
    },
  ],
  reviewsCount: 89,
  averageRating: 4.8,

  cta: {
    type: "записаться",
    primaryLabel: "Записаться в лагерь",
    secondaryLabel: "В план",
    phone: "+375 29 987 65 43",
    instructions: "Оставьте заявку — мы свяжемся для уточнения деталей и брони места",
  },

  perks: [
    { stat: "5:1", label: "ВОСПИТАТЕЛЬ НА ГРУППУ", desc: "Маленькие отряды до 14 человек. Каждого ребёнка видно." },
    { stat: "4h", label: "АНГЛИЙСКОГО В ДЕНЬ", desc: "Игровой формат, песни и квесты. Никаких учебников и зубрёжки." },
    { stat: "24/7", label: "СВЯЗЬ С РОДИТЕЛЯМИ", desc: "Daily-чат в Telegram с фото, видео и отчётами от кураторов." },
    { stat: "100%", label: "ВОЗВРАТ ЗА 24 ЧАСА", desc: "Если не понравилась первая смена — вернём деньги без вопросов." },
  ],

  similar: [
    {
      id: "sim-1",
      title: "Лингвистический лагерь English Camp",
      slug: "english-camp-naroch",
      coverUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400",
      priceLabel: "от 790 BYN",
      ageLabel: "8–14 лет",
      placeTitle: "Лагерь «Звёздный»",
      rating: 4.7,
      reviewsCount: 54,
    },
    {
      id: "sim-2",
      title: "Спортивный лагерь «Чемпион»",
      slug: "sport-camp-champion",
      coverUrl: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400",
      priceLabel: "от 650 BYN",
      ageLabel: "9–16 лет",
      placeTitle: "Спорткомплекс «Олимп»",
      rating: 4.9,
      reviewsCount: 102,
    },
    {
      id: "sim-3",
      title: "Творческий лагерь «Арт-Лето»",
      slug: "art-camp-summer",
      coverUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400",
      priceLabel: "от 720 BYN",
      ageLabel: "7–15 лет",
      placeTitle: "Центр творчества «Мозаика»",
      rating: 4.6,
      reviewsCount: 38,
    },
  ],

  seo: {
    title: "Летний лагерь «Бизнес-старт» на озере Нарочь 2026",
    description: "Летний лагерь для детей 10–16 лет на озере Нарочь. Предпринимательство, спорт, творчество. Безопасная территория, 5-разовое питание.",
  },
};

/**
 * Mock: Летний лагерь (CAMP)
 */
export const mockCampOffer: OfferPageData = {
  id: "offer-camp-1",
  slug: "summer-camp-adventure",
  citySlug: "minsk",
  title: "Летний лагерь «Приключения»",
  shortDescription: "Незабываемое лето на природе! Активный отдых, творчество, новые друзья и яркие впечатления.",
  description: `
    <h3>О лагере</h3>
    <p>Летний лагерь для детей 7-14 лет на берегу озера. Программа включает спорт, творчество, экскурсии и развлечения.</p>
    
    <h3>Программа смены</h3>
    <ul>
      <li>Спортивные игры и соревнования</li>
      <li>Творческие мастер-классы</li>
      <li>Походы и экскурсии</li>
      <li>Вечерние дискотеки и костры</li>
      <li>Купание в озере под присмотром</li>
    </ul>
    
    <h3>Преимущества</h3>
    <ul>
      <li>Опытные вожатые и педагоги</li>
      <li>Безопасная территория с охраной</li>
      <li>5-разовое питание</li>
      <li>Медицинское сопровождение 24/7</li>
    </ul>
  `,
  offerType: "CAMP",
  
  media: {
    posterUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200",
    posterAlt: "Дети в летнем лагере",
    gallery: [
      {
        id: "1",
        url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800",
        alt: "Территория лагеря",
      },
      {
        id: "2",
        url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
        alt: "Спортивные игры",
      },
      {
        id: "3",
        url: "https://images.unsplash.com/photo-1478827536114-da961b7f86d0?w=800",
        alt: "Костёр",
      },
    ],
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoLabel: "Трейлер лагеря",
  },
  
  metaGrid: [
    { id: "1", icon: "age", label: "Возраст", value: "7-14 лет" },
    { id: "2", icon: "duration", label: "Длительность", value: "14 дней" },
    { id: "3", icon: "format", label: "Формат", value: "Выездной лагерь" },
    { id: "4", icon: "location", label: "Место", value: "Озеро Нарочь" },
  ],
  
  pricing: {
    mode: "single",
    priceFrom: "850 BYN",
    oldPrice: "944 BYN",
    priceCaption: "/ смена",
    promotionText: "Раннее бронирование -10%",
    promotionSubtitle: "При оплате до 1 мая",
    promoTitle: "-10% до конца мая",
    promoUntil: "2026-05-31T23:59:59.000Z",
    promotionDetails: `<ul><li><strong>-10%</strong> на второго члена семьи (кровные узы)</li><li><strong>-15%</strong> приведи друга, который запишется</li><li><strong>-10%</strong> ранняя запись до 31 мая 2026</li></ul>`,
  },
  
  schedule: {
    type: "shifts",
    items: [
      {
        id: "1",
        title: "Первая смена",
        dateFrom: "1 июня",
        dateTo: "14 июня",
        duration: "14 дней",
        ageRange: "7-14 лет",
        spotsLeft: 5,
        capacity: 30,
        price: "850 BYN",
        ctaEnabled: true,
        ctaLabel: "Забронировать",
      },
      {
        id: "2",
        title: "Вторая смена",
        dateFrom: "16 июня",
        dateTo: "29 июня",
        duration: "14 дней",
        ageRange: "7-14 лет",
        spotsLeft: 12,
        capacity: 30,
        price: "850 BYN",
        ctaEnabled: true,
        ctaLabel: "Забронировать",
      },
      {
        id: "3",
        title: "Третья смена",
        dateFrom: "1 июля",
        dateTo: "14 июля",
        duration: "14 дней",
        ageRange: "7-14 лет",
        spotsLeft: 18,
        capacity: 30,
        price: "850 BYN",
        ctaEnabled: true,
        ctaLabel: "Забронировать",
      },
    ],
  },
  
  accommodation: {
    provided: true,
    type: "База отдыха",
    address: "Озеро Нарочь, база отдыха «Лесная»",
    rooms: "Комнаты по 4-6 человек с удобствами",
    conditions: "Душ, туалет, Wi-Fi в общих зонах",
    meals: ["breakfast", "lunch", "dinner", "snacks"],
    mealInfo: "5-разовое питание, учитываем аллергии и предпочтения",
    transferInfo: "Организованный трансфер из Минска (включён в стоимость)",
    whatToBring: "Удобная одежда и обувь, купальник, средства гигиены, головной убор",
    safetyInfo: "Территория огорожена и охраняется. Купание только под присмотром инструкторов.",
    medicalInfo: "Медпункт на территории, врач 24/7. Необходима справка о здоровье.",
  },
  
  place: {
    id: "place-camp-1",
    name: "База отдыха «Лесная»",
    slug: "lesnaya-base",
    address: "Озеро Нарочь",
    district: "Мядельский район",
    lat: 54.8667,
    lng: 26.7333,
  },
  
  reviews: [
    {
      id: "1",
      authorName: "Ольга Михайлова",
      rating: 5,
      text: "Ребёнок вернулся счастливый и загорелый! Отличная организация, внимательные вожатые. Обязательно поедем ещё!",
      date: "20 июля 2025",
      helpful: 15,
    },
    {
      id: "2",
      authorName: "Сергей Волков",
      rating: 5,
      text: "Лучший лагерь! Дочь в восторге, нашла новых друзей. Программа насыщенная, скучать некогда.",
      date: "15 июля 2025",
      helpful: 10,
    },
  ],
  reviewsCount: 89,
  averageRating: 4.9,
  
  cta: {
    type: "забронировать",
    primaryLabel: "Забронировать место",
    secondaryLabel: "В план",
    phone: "+375 29 987 65 43",
    instructions: "Оставьте заявку, мы свяжемся для уточнения деталей",
  },
  
  similar: [],
  
  seo: {
    title: "Летний лагерь «Приключения» на озере Нарочь | Лагеря для детей",
    description: "Летний лагерь для детей 7-14 лет. Активный отдых, творчество, спорт. Безопасная территория, опытные вожатые. Бронируйте место!",
  },
};

/**
 * Mock: Лесная сказка (CAMP) — новый editorial-дизайн
 * Используется для превью нового OfferPageView.
 * URL: /minsk/offers/camps/summer-camp?mock=lesnaya-skazka
 */
export const mockLesnayaSkazka: OfferPageData = {
  id: "mock-camp-001",
  offerType: "CAMP",
  citySlug: "minsk",
  slug: "lesnaya-skazka",
  title: "Лесная сказка",

  shortDescription:
    "Загородный лагерь для детей от 7 до 14 лет. Творчество, спорт и природа — всё лето в одном месте.",

  place: {
    id: "place-001",
    name: "Лесная база «Сказка»",
    slug: "lesnaya-baza-skazka",
    tagline: "в лесу, вдали от города",
    address: "Минский район, д. Строчицы\n32 км от МКАД",
    district: "Минский район",
    tags: ["Лес рядом", "Река 500 м", "Трансфер из Минска"],
    lat: 53.722,
    lng: 27.481,
  },

  media: {
    posterUrl: "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=1200&q=80",
    posterAlt: "Дети в летнем лагере на природе",
    videoUrl: "",
    gallery: [
      { id: "g1", url: "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=800&q=80", alt: "Территория лагеря" },
      { id: "g2", url: "https://images.unsplash.com/photo-1527525443983-6e60c75fff46?w=800&q=80", alt: "Творческие занятия" },
      { id: "g3", url: "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&q=80", alt: "Спортивная площадка" },
      { id: "g4", url: "https://images.unsplash.com/photo-1551958219-acbc595d6fd2?w=800&q=80", alt: "Столовая" },
    ],
  },

  metaGrid: [
    { id: "m1", label: "Возраст", value: "7–14 лет" },
    { id: "m2", label: "Длительность", value: "21 день" },
    { id: "m3", label: "Питание", value: "5-разовое" },
    { id: "m4", label: "Вожатые", value: "1 на 8 детей" },
    { id: "m5", label: "Направление", value: "Творчество + спорт" },
  ],

  pricing: {
    priceDisplay: "890",
    priceUnit: "BYN / смена",
    priceFrom: "от 890 BYN",
    priceCaption: "за смену",
    oldPrice: "990 BYN",
    promotionText: "−10% до конца мая",
    promoUntil: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
    discounts: [
      { rate: "-10%", label: "на второго члена семьи (кровные узы)" },
      { rate: "-15%", label: "приведи друга, который запишется" },
      { rate: "-10%", label: "ранняя запись до 31 мая 2026" },
    ],
    options: [
      { id: "o1", title: "1 смена (21 день)", price: "890 BYN" },
      { id: "o2", title: "2 смены (42 дня)", price: "1 590 BYN" },
      { id: "o3", title: "Дополнительные занятия", price: "+60 BYN" },
    ],
  },

  averageRating: 4.9,

  cta: {
    primaryLabel: "Записаться в лагерь",
    secondaryLabel: "В план",
  },

  schedule: {
    type: "shifts",
    items: [
      {
        id: "s1",
        title: "1-я смена",
        ageRange: "7–10 лет",
        dateFrom: "1 июля",
        dateTo: "21 июля",
        duration: "21 день",
        price: "890 BYN",
        capacity: 30,
        spotsLeft: 8,
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
      {
        id: "s2",
        title: "2-я смена",
        ageRange: "10–14 лет",
        dateFrom: "25 июля",
        dateTo: "14 августа",
        duration: "21 день",
        price: "890 BYN",
        capacity: 30,
        spotsLeft: 18,
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
      {
        id: "s3",
        title: "3-я смена",
        ageRange: "7–14 лет",
        dateFrom: "18 августа",
        dateTo: "7 сентября",
        duration: "21 день",
        price: "890 BYN",
        capacity: 30,
        spotsLeft: 0,
        ctaEnabled: false,
        ctaLabel: "Мест нет",
      },
    ],
  },

  reviews: [
    {
      id: "r1",
      authorName: "Анна Смирнова",
      date: "август 2024",
      rating: 5,
      text: "Дочь провела здесь всё лето и уже просится снова. Персонал внимательный, питание отличное.",
    },
    {
      id: "r2",
      authorName: "Игорь Петров",
      date: "июль 2024",
      rating: 5,
      text: "Сын вернулся с горящими глазами. Много новых друзей и столько впечатлений — спасибо команде лагеря!",
    },
    {
      id: "r3",
      authorName: "Мария Ковалёва",
      date: "июль 2024",
      rating: 4,
      text: "Отличная организация, красивая природа. Единственное — хотелось бы чуть больше творческих мастер-классов.",
    },
    {
      id: "r4",
      authorName: "Дмитрий Зайцев",
      date: "август 2024",
      rating: 5,
      text: "Три года подряд отправляем детей только сюда. Каждый раз уезжают счастливыми.",
    },
  ],

  promoCta: {
    promoUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    headline: "Запишите ребёнка на лучшее лето.",
    accentWord: "лучшее",
    subtitle:
      "Оставьте заявку — куратор перезвонит за 30 минут и подберёт смену, удобную для вашей семьи.",
    primaryLabel: "Записаться за 890 BYN",
    secondaryLabel: "Получить программу в Telegram",
    secondaryHref: "https://t.me/mamago_by",
    trustLine:
      "Без предоплаты · возврат за 24 часа · 12 семей уже записались сегодня",
  },
};
