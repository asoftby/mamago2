import type {
  UserBirthdayParty,
  UserBirthdayPartyDetail,
} from "@/features/me/types/userBirthdayParty";

const MOCK_PARTY_DETAIL: UserBirthdayPartyDetail = {
  id: "demo-birthday-scenario",
  userId: "__every__",
  childName: "Тая",
  title: "Праздник Таи",
  status: "partial",
  dateIso: "2026-06-06",
  timeStart: "13:00",
  timeEnd: "16:00",
  previewItems: ["Площадка", "Аниматор", "Торт"],
  confirmationCount: 2,
  confirmationTotal: 3,
  scenarioFlow: [
    { slot: "cake", confirmed: true },
    { slot: "place", confirmed: true },
    { slot: "animator", confirmed: false },
  ],
  updatedAt: "2026-06-03T10:00:00.000Z",
  scenarioLines: ["Площадка", "Аниматор", "Торт"],
  scenarioFlowLabels: ["Торт", "Площадка", "Аниматор"],
  themeLabel: "Научный праздник",
  durationHint: "3 часа",
  services: [],
  organizers: [],
  formatLabel: "На площадке",
  childAgeLabel: "11 лет",
  guestsLabel: "10–15 детей",
  totalPrice: 790,
  timelineItems: [
    {
      id: "cake-delivery",
      time: "12:30",
      type: "performer",
      title: "Торт доставить на площадку",
      subtitle: "Торт на заказ • 3 кг",
      price: 120,
      status: "CONFIRMED",
      contactLabel: "Контакт",
      contact: {
        name: "Татьяна",
        phone: "+375 29 123–45–67",
        telegram: "https://t.me/mamago_cakes",
      },
    },
    {
      id: "venue",
      time: "13:00–16:00",
      type: "performer",
      title: "Площадка",
      subtitle: "Лофт «Облака» • «Всё включено»",
      price: 480,
      status: "CONFIRMED",
      contactLabel: "Контакт площадки",
      contact: {
        name: "Анна",
        phone: "+375 29 555–80–80",
        messageHref: "https://t.me/mamago_loft",
      },
    },
    {
      id: "guest-welcome",
      time: "13:30",
      type: "internal",
      title: "Сбор гостей",
      description: "15 мин на встречу гостей и welcome-зону",
    },
    {
      id: "animator",
      time: "14:00–15:00",
      type: "performer",
      title: "Аниматор",
      subtitle: "Научное шоу с опытами",
      price: 190,
      status: "DECLINED",
      alternatives: [
        {
          id: "alt-bubbles",
          category: "Аниматор",
          title: "Шоу мыльных пузырей",
          rating: 4.8,
          price: 170,
        },
        {
          id: "alt-magician",
          category: "Аниматор",
          title: "Фокусник для детей",
          rating: 4.9,
          price: 200,
        },
        {
          id: "alt-minecraft",
          category: "Аниматор",
          title: "Аниматор в стиле Minecraft",
          rating: 4.7,
          price: 220,
        },
      ],
    },
    {
      id: "cake-out",
      time: "15:15",
      type: "internal",
      title: "Вынос торта и поздравление",
      description: "после завершения шоу",
    },
    {
      id: "free-program",
      time: "15:30–16:00",
      type: "internal",
      title: "Свободная программа / фото / завершение",
    },
  ],
};

export async function listUserBirthdayParties(
  userId: string,
): Promise<UserBirthdayParty[]> {
  return [{ ...MOCK_PARTY_DETAIL, userId }];
}

export async function getUserBirthdayPartyDetail(
  userId: string,
  partyId: string,
): Promise<UserBirthdayPartyDetail | null> {
  if (partyId !== MOCK_PARTY_DETAIL.id) return null;
  return { ...MOCK_PARTY_DETAIL, userId };
}
