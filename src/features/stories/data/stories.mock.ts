import type { StoryCollection } from "../types/story";

export const MOCK_STORIES: StoryCollection[] = [
  {
    id: "today",
    intent: "today",
    title: "Сегодня",
    emoji: "☀️",
    items: [
      {
        id: "t1",
        title: "Мастер-класс по лепке из глины",
        image:
          "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=800&auto=format&fit=crop",
        age: "4–10 лет",
        location: "Центр, Минск",
        datetime: "Сегодня, 12:00",
        price: "от 25 BYN",
        businessName: "Арт-студия Краски",
      },
      {
        id: "t2",
        title: "Интерактивный планетарий для детей",
        image:
          "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800&auto=format&fit=crop",
        age: "5–12 лет",
        location: "Октябрьский р-н",
        datetime: "Сегодня, 14:00",
        price: "от 15 BYN",
        businessName: "Планетарий Минска",
      },
      {
        id: "t3",
        title: "Семейный квест «Тайна старого замка»",
        image:
          "https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=800&auto=format&fit=crop",
        age: "6–14 лет",
        location: "Немига",
        datetime: "Сегодня, 16:00",
        price: "от 40 BYN",
        businessName: "Квест-клуб Загадка",
      },
    ],
  },
  {
    id: "weekend",
    intent: "weekend",
    title: "Выходные",
    emoji: "🎉",
    items: [
      {
        id: "w1",
        title: "Фестиваль уличной еды с детской зоной",
        image:
          "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop",
        age: "0+",
        location: "Парк Горького",
        datetime: "Сб–Вс, 11:00–20:00",
        price: "Вход свободный",
        businessName: "Минск Food Fest",
      },
      {
        id: "w2",
        title: "Театр кукол: «Золушка»",
        image:
          "https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=800&auto=format&fit=crop",
        age: "3–8 лет",
        location: "Театр кукол, пр. Независимости",
        datetime: "Воскресенье, 12:00",
        price: "от 12 BYN",
        businessName: "Белорусский театр кукол",
      },
      {
        id: "w3",
        title: "Велопрогулка по набережной с детьми",
        image:
          "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=800&auto=format&fit=crop",
        age: "3+",
        location: "Набережная Свислочи",
        datetime: "Суббота, 10:00",
        price: "Бесплатно",
      },
      {
        id: "w4",
        title: "Мастер-класс по рисованию акварелью",
        image:
          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop",
        age: "5–12 лет",
        location: "Троицкое предместье",
        datetime: "Суббота, 14:00",
        price: "от 30 BYN",
        businessName: "Арт-студия Краски",
        isPromoted: true,
      },
    ],
  },
  {
    id: "free",
    intent: "free",
    title: "Бесплатно",
    emoji: "🎁",
    items: [
      {
        id: "f1",
        title: "Велопрогулка по набережной с детьми",
        image:
          "https://images.unsplash.com/photo-1541625602330-2277a4c46182?q=80&w=800&auto=format&fit=crop",
        age: "3+",
        location: "Набережная Свислочи",
        datetime: "Каждые выходные, 10:00",
        price: "Бесплатно",
      },
      {
        id: "f2",
        title: "Открытый день в Ботаническом саду",
        image:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=800&auto=format&fit=crop",
        age: "0+",
        location: "Ботанический сад",
        datetime: "Воскресенье, 10:00–18:00",
        price: "Бесплатно",
      },
      {
        id: "f3",
        title: "Детская площадка в Лошицком парке",
        image:
          "https://images.unsplash.com/photo-1545558014-8692077e9b5c?q=80&w=800&auto=format&fit=crop",
        age: "1–10 лет",
        location: "Лошицкий парк",
        datetime: "Ежедневно",
        price: "Бесплатно",
      },
    ],
  },
  {
    id: "near",
    intent: "near",
    title: "Рядом",
    emoji: "📍",
    items: [
      {
        id: "nr1",
        title: "Детский развивающий центр «Умка»",
        image:
          "https://images.unsplash.com/photo-1587654780291-39c9404d746b?q=80&w=800&auto=format&fit=crop",
        age: "1–6 лет",
        location: "0.3 км от вас",
        datetime: "Пн–Пт, 9:00–19:00",
        price: "от 20 BYN / занятие",
        businessName: "Центр Умка",
      },
      {
        id: "nr2",
        title: "Бассейн с детскими дорожками",
        image:
          "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?q=80&w=800&auto=format&fit=crop",
        age: "3+",
        location: "0.8 км от вас",
        datetime: "Ежедневно, 7:00–22:00",
        price: "от 18 BYN",
        businessName: "Аквацентр Лазурный",
      },
      {
        id: "nr3",
        title: "Кафе с детской комнатой «Семейное»",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop",
        age: "0+",
        location: "1.1 км от вас",
        datetime: "Ежедневно, 10:00–22:00",
        businessName: "Кафе Семейное",
      },
    ],
  },
  {
    id: "age_3_5",
    intent: "age_3_5",
    title: "3–5 лет",
    emoji: "🧸",
    items: [
      {
        id: "a1",
        title: "Сенсорная комната для малышей",
        image:
          "https://images.unsplash.com/photo-1587654780291-39c9404d746b?q=80&w=800&auto=format&fit=crop",
        age: "2–5 лет",
        location: "Центр, Минск",
        datetime: "Пн–Сб, 10:00–18:00",
        price: "от 15 BYN",
        businessName: "Центр Умка",
      },
      {
        id: "a2",
        title: "Театр кукол: «Золушка»",
        image:
          "https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=800&auto=format&fit=crop",
        age: "3–8 лет",
        location: "пр. Независимости",
        datetime: "Воскресенье, 12:00",
        price: "от 12 BYN",
        businessName: "Белорусский театр кукол",
      },
      {
        id: "a3",
        title: "Мастер-класс по лепке из глины",
        image:
          "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=800&auto=format&fit=crop",
        age: "4–10 лет",
        location: "Центр, Минск",
        datetime: "Сегодня, 12:00",
        price: "от 25 BYN",
        businessName: "Арт-студия Краски",
      },
    ],
  },
  {
    id: "new",
    intent: "new",
    title: "Новое",
    emoji: "✨",
    items: [
      {
        id: "nw1",
        title: "Самая безопасная игровая в Минске",
        image:
          "https://images.unsplash.com/photo-1545558014-8692077e9b5c?q=80&w=800&auto=format&fit=crop",
        age: "1–8 лет",
        location: "Серебрянка",
        datetime: "Открылась на этой неделе",
        price: "Бесплатно",
      },
      {
        id: "nw2",
        title: "Выставка птиц в Троицком предместье",
        image:
          "https://images.unsplash.com/photo-1444464666168-e49d077b8a7e?q=80&w=800&auto=format&fit=crop",
        age: "0+",
        location: "Троицкое предместье",
        datetime: "До 30 апреля",
        price: "от 10 BYN",
      },
      {
        id: "nw3",
        title: "Новый квартал с детскими активностями",
        image:
          "https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=800&auto=format&fit=crop",
        age: "0+",
        location: "Маяк Минска",
        datetime: "Открыт ежедневно",
        price: "Вход свободный",
        isPromoted: true,
      },
      {
        id: "nw4",
        title: "Весенняя фотозона в ботаническом саду",
        image:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=800&auto=format&fit=crop",
        age: "0+",
        location: "Ботанический сад",
        datetime: "Апрель–май",
        price: "Бесплатно",
      },
    ],
  },
];
