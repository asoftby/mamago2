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
    videoThumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
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
    priceCaption: "за смену (14 дней)",
    promotionText: "Раннее бронирование -10%",
    promotionSubtitle: "При оплате до 1 мая",
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
