// Mock routes for visual demo — used in catalog and route detail pages

export type MockRouteStop = {
  id: string;
  order: number;
  title?: string; // display name (place title or customTitle)
  address: string; // raw address / location label (город, улица, дом)
  note: string;
  photoUrl?: string; // Legacy: single photo (для обратной совместимости)
  photos?: string[]; // New: multiple photos support
  lat?: number;
  lng?: number;
};

export type MockRoute = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: "FREE" | "LOW" | "MEDIUM" | "HIGH";
  cityName: string;
  coverImageUrl: string;
  authorName: string | null; // null = editorial (mamaGo)
  authorAvatar?: string;
  isEditorial: boolean;
  stopsCount: number;
  stops: MockRouteStop[];
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
};

export const BUDGET_LABELS: Record<MockRoute["budgetLevel"], string> = {
  FREE: "Бесплатно",
  LOW: "до 50 BYN",
  MEDIUM: "50–150 BYN",
  HIGH: "150+ BYN",
};

export const MOCK_ROUTES: MockRoute[] = [
  {
    id: "route-1",
    slug: "minsk-family-saturday",
    title: "Семейная суббота в Минске",
    ageTags: ["3-5", "5-7"],
    budgetLevel: "LOW",
    cityName: "Минск",
    coverImageUrl:
      "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
    authorName: null,
    authorAvatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200",
    isEditorial: true,
    stopsCount: 4,
    createdAt: "2024-11-10T10:00:00Z",
    updatedAt: "2024-12-15T14:30:00Z",
    stops: [
      {
        id: "s1-1",
        order: 1,
        title: "Парк Горького",
        address: "Минск, пр. Независимости, 2",
        note: "Начните день здесь — аттракционы открываются в 10:00, очередей почти нет. Возьмите билеты на карусель сразу.",
        photoUrl:
          "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=800",
        photos: [
          "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=800",
          "https://images.unsplash.com/photo-1560807707-8cc77767d783?q=80&w=800",
          "https://images.unsplash.com/photo-1486299267070-83823f5448dd?q=80&w=800",
          "https://images.unsplash.com/photo-1523627945-eba974c3e7c6?q=80&w=800",
          "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800",
        ],
        lat: 53.9006,
        lng: 27.5615,
      },
      {
        id: "s1-2",
        order: 2,
        title: "Детская железная дорога",
        address: "Минск, ул. Парковая",
        note: "10 минут пешком от парка. Поезд ведут сами дети — это настоящий восторг. Работает ср–вс, расписание лучше проверить заранее.",
        photoUrl:
          "https://images.unsplash.com/photo-1515165592879-0ef31ee18e66?q=80&w=800",
        lat: 53.8983,
        lng: 27.5701,
      },
      {
        id: "s1-3",
        order: 3,
        title: "Семейное кафе «Андерсон»",
        address: "Минск, ул. Немига, 5",
        note: "Отличное место для обеда — большая игровая зона, пока вы едите. Бронируйте столик заранее в выходные.",
        photoUrl:
          "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=800",
        lat: 53.9065,
        lng: 27.5495,
      },
      {
        id: "s1-4",
        order: 4,
        title: "Музей Lego «Las-Legas»",
        address: "Минск, пр. Победителей, 9",
        note: "Финальная точка — дети могут строить сколько угодно. Лучше приходить после обеда, когда утренний поток спадает.",
        photoUrl:
          "https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?q=80&w=800",
        lat: 53.9112,
        lng: 27.5823,
      },
    ],
  },
  {
    id: "route-2",
    slug: "minsk-science-day",
    title: "День науки и открытий",
    ageTags: ["7-9", "9-12"],
    budgetLevel: "MEDIUM",
    cityName: "Минск",
    coverImageUrl:
      "https://images.unsplash.com/photo-1530103862676-de3c9a59af57?q=80&w=1200",
    authorName: null,
    isEditorial: true,
    stopsCount: 3,
    createdAt: "2024-10-20T09:00:00Z",
    updatedAt: "2024-12-01T11:15:00Z",
    stops: [
      {
        id: "s2-1",
        order: 1,
        title: "Научный музей «Элементо»",
        address: "Минск, пр. Независимости, 25",
        note: "Приходите к открытию — интерактивные экспонаты быстро занимают. Шоу с жидким азотом в 11:00 и 14:00.",
        photoUrl:
          "https://images.unsplash.com/photo-1530103862676-de3c9a59af57?q=80&w=800",
        lat: 53.9045,
        lng: 27.5615,
      },
      {
        id: "s2-2",
        order: 2,
        title: "Выставка роботов «RoboPark»",
        address: "Минск, пр. Независимости, 27",
        note: "Рядом с Элементо, 5 минут пешком. Можно управлять роботами самостоятельно — дети в восторге.",
        photoUrl:
          "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=800",
        lat: 53.9052,
        lng: 27.563,
      },
      {
        id: "s2-3",
        order: 3,
        title: "Пробное занятие по робототехнике",
        address: "Минск, ул. Кальварийская, 3",
        note: "Запишитесь заранее — первое занятие бесплатно. Хорошо подходит как финал дня, дети уходят с готовой поделкой.",
        photoUrl:
          "https://images.unsplash.com/photo-1589254065878-42c9da997008?q=80&w=800",
        lat: 53.912,
        lng: 27.548,
      },
    ],
  },
  {
    id: "route-3",
    slug: "minsk-active-weekend",
    title: "Активные выходные для всей семьи",
    ageTags: ["5-7", "7-9"],
    budgetLevel: "LOW",
    cityName: "Минск",
    coverImageUrl:
      "https://images.unsplash.com/photo-1526676037777-05a232554f77?q=80&w=1200",
    authorName: "Анна К.",
    authorAvatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200",
    isEditorial: false,
    stopsCount: 3,
    createdAt: "2024-11-25T16:20:00Z",
    stops: [
      {
        id: "s3-1",
        order: 1,
        title: "Батутный центр «Hero Park»",
        address: "Минск, ул. Притыцкого, 101",
        note: "Открывается в 10:00. Берите носки — без них не пустят. Час прыжков хватает детям с головой.",
        photoUrl:
          "https://images.unsplash.com/photo-1526676037777-05a232554f77?q=80&w=800",
        lat: 53.918,
        lng: 27.495,
      },
      {
        id: "s3-2",
        order: 2,
        title: "Верёвочный парк «Маугли»",
        address: "Минск, ул. Лобанка, 15",
        note: "Трассы разной сложности — есть для малышей от 5 лет. Инструктор всегда рядом, безопасно.",
        photoUrl:
          "https://images.unsplash.com/photo-1596324916867-b8696773322d?q=80&w=800",
        lat: 53.921,
        lng: 27.502,
      },
      {
        id: "s3-3",
        order: 3,
        title: "Ботанический сад",
        address: "Минск, ул. Surganova, 2в",
        note: "Спокойная прогулка после активного дня. Дети любят фонтаны и теплицы с экзотическими растениями.",
        photoUrl:
          "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?q=80&w=800",
        lat: 53.927,
        lng: 27.589,
      },
    ],
  },
  {
    id: "route-4",
    slug: "minsk-culture-walk",
    title: "Культурная прогулка по центру",
    ageTags: ["5-7", "7-9", "9-12"],
    budgetLevel: "FREE",
    cityName: "Минск",
    coverImageUrl:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?q=80&w=1200",
    authorName: "Мария Л.",
    authorAvatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200",
    isEditorial: false,
    stopsCount: 3,
    createdAt: "2024-12-05T13:45:00Z",
    stops: [
      {
        id: "s4-1",
        order: 1,
        title: "Ботанический сад",
        address: "Минск, ул. Surganova, 2в",
        note: "Начните с утренней прогулки — в будни почти пусто. Дети любят искать необычные растения.",
        photoUrl:
          "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?q=80&w=800",
        lat: 53.927,
        lng: 27.589,
      },
      {
        id: "s4-2",
        order: 2,
        title: "Котокафе «Котейка»",
        address: "Минск, ул. Ленина, 12",
        note: "Уютное место для перерыва. Коты ручные, дети в восторге. Лучше бронировать столик.",
        photoUrl:
          "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=800",
        lat: 53.905,
        lng: 27.561,
      },
      {
        id: "s4-3",
        order: 3,
        title: "Парк Горького",
        address: "Минск, пр. Независимости, 2",
        note: "Завершите прогулку здесь — аттракционы, мороженое, хорошая атмосфера.",
        photoUrl:
          "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=800",
        lat: 53.9006,
        lng: 27.5615,
      },
    ],
  },
];
