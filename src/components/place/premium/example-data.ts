/**
 * Примеры данных для тестирования Premium Place Landing Page
 */

export const examplePlace = {
  id: "place-123",
  title: "Культурный центр «Корпус»",
  slug: "korpus-minsk",
  category: "Культурное пространство",
  shortDesc: "Современное пространство для творчества, обучения и культурных мероприятий в центре Минска",
  description: `Культурный центр «Корпус» — это уникальное пространство, где встречаются искусство, образование и сообщество. 

Мы создали место, где каждый может найти вдохновение, развить свои таланты и познакомиться с единомышленниками. Наши залы оборудованы современной техникой и создают идеальную атмосферу для любых мероприятий.

С 2018 года мы проводим более 200 событий в год: от камерных концертов до масштабных фестивалей, от мастер-классов до бизнес-конференций.`,
  logoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400",
  rating: 4.8,
  reviewCount: 127,

  // Quick facts
  yearFounded: 2018,
  languages: ["Русский", "Беларуская", "English"],
  capacity: 250,

  // Contact
  phone: "+375 29 123 45 67",
  email: "info@korpus.by",
  website: "https://korpus.by",
  
  // Location
  address: "ул. Октябрьская, 16, Минск",
  city: "Минск",
  district: "Центральный район",
  latitude: 53.9006,
  longitude: 27.5590,

  breadcrumbItems: [
    { label: "Главная", href: "/" },
    { label: "Минск", href: "/minsk" },
    { label: "Культурный центр «Корпус»" },
  ],
  mapsOpenUrl: "https://maps.google.com/?q=53.9006,27.5590",
  mapsDirectionsUrl: "https://maps.google.com/maps?daddr=53.9006,27.5590",
  workingHoursSummary: "Открыто до 22:00",

  // Content
  features: [
    "Профессиональное звуковое оборудование",
    "Проекционная система 4K",
    "Гибкая планировка пространства",
    "Кейтеринг и бар",
    "Техническая поддержка мероприятий",
    "Удобная транспортная доступность",
  ],
  amenities: [
    "Wi-Fi",
    "Парковка",
    "Гардероб",
    "Кондиционер",
    "Доступ для людей с ограниченными возможностями",
    "Кухня",
    "Звукозапись",
    "Фотостудия",
  ],
  
  // Media
  images: [
    {
      id: "1",
      url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200",
      alt: "Главный зал",
    },
    {
      id: "2",
      url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600",
      alt: "Концертная площадка",
    },
    {
      id: "3",
      url: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=600",
      alt: "Конференц-зал",
    },
    {
      id: "4",
      url: "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600",
      alt: "Лаунж-зона",
    },
    {
      id: "5",
      url: "https://images.unsplash.com/photo-1519167758481-83f29da8c2b0?w=600",
      alt: "Выставочное пространство",
    },
  ],
};

export const exampleEvents = [
  {
    id: "event-1",
    title: "Джазовый вечер с Минским джаз-квартетом",
    slug: "jazz-evening-minsk",
    imageUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600",
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Главный зал",
    price: 25,
    category: "Концерт",
  },
  {
    id: "event-2",
    title: "Мастер-класс по керамике",
    slug: "ceramics-workshop",
    imageUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600",
    startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Творческая мастерская",
    price: 35,
    category: "Мастер-класс",
  },
  {
    id: "event-3",
    title: "Выставка современного искусства «Грани»",
    slug: "modern-art-exhibition",
    imageUrl: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=600",
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Выставочный зал",
    price: 0,
    category: "Выставка",
  },
  {
    id: "event-4",
    title: "Бизнес-завтрак: Маркетинг в 2026",
    slug: "business-breakfast-marketing",
    imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=600",
    startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Конференц-зал",
    price: 15,
    category: "Бизнес",
  },
];

export const exampleOffers = [
  {
    id: "offer-1",
    title: "Аренда зала для мероприятий",
    slug: "hall-rental",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600",
    description: "Просторный зал с профессиональным оборудованием для ваших мероприятий",
    price: 150,
    duration: "от 3 часов",
    capacity: 250,
    category: "Аренда",
  },
  {
    id: "offer-2",
    title: "Организация корпоративных мероприятий",
    slug: "corporate-events",
    imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=600",
    description: "Полный цикл организации: от концепции до реализации",
    price: 500,
    discount: 15,
    duration: "под ключ",
    capacity: 200,
    category: "Услуги",
  },
  {
    id: "offer-3",
    title: "Абонемент на мастер-классы",
    slug: "workshop-subscription",
    imageUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600",
    description: "5 мастер-классов на выбор в течение месяца",
    price: 120,
    discount: 20,
    duration: "1 месяц",
    category: "Абонемент",
  },
  {
    id: "offer-4",
    title: "Фотосессия в интерьерах центра",
    slug: "photoshoot-package",
    imageUrl: "https://images.unsplash.com/photo-1519167758481-83f29da8c2b0?w=600",
    description: "2 часа съемки в уникальных локациях нашего пространства",
    price: 80,
    duration: "2 часа",
    category: "Услуги",
  },
];

export const exampleReviews = [
  {
    id: "review-1",
    authorName: "Анна Петрова",
    authorAvatar: "https://i.pravatar.cc/150?img=1",
    rating: 5,
    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    text: "Прекрасное место для проведения мероприятий! Организовывали здесь корпоратив на 100 человек — всё прошло идеально. Профессиональная команда, отличное оборудование, удобное расположение. Обязательно вернёмся!",
    helpful: 12,
  },
  {
    id: "review-2",
    authorName: "Дмитрий Соколов",
    authorAvatar: "https://i.pravatar.cc/150?img=12",
    rating: 5,
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    text: "Ходим сюда на концерты уже второй год. Атмосфера невероятная, акустика отличная, всегда интересная программа. Это место стало для нас настоящим культурным центром Минска.",
    helpful: 8,
  },
  {
    id: "review-3",
    authorName: "Елена Иванова",
    authorAvatar: "https://i.pravatar.cc/150?img=5",
    rating: 4,
    date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    text: "Посещала мастер-класс по керамике. Очень понравилось! Преподаватель профессионал, все материалы предоставлены, атмосфера творческая. Единственный минус — парковка иногда переполнена, но это мелочи.",
    helpful: 5,
  },
  {
    id: "review-4",
    authorName: "Максим Кузнецов",
    authorAvatar: "https://i.pravatar.cc/150?img=8",
    rating: 5,
    date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    text: "Арендовали зал для презентации продукта. Всё на высшем уровне: техника работает безупречно, персонал помогал с настройкой, даже кофе-брейк организовали. Цена адекватная. Рекомендую!",
    helpful: 15,
  },
  {
    id: "review-5",
    authorName: "Ольга Смирнова",
    authorAvatar: "https://i.pravatar.cc/150?img=9",
    rating: 5,
    date: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
    text: "Была на выставке современного искусства. Пространство идеально подходит для таких мероприятий — высокие потолки, хорошее освещение, продуманная планировка. Обязательно приду ещё!",
    helpful: 6,
  },
];
