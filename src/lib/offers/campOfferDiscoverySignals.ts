import type { SignalEntityType } from "@prisma/client";

export type CampOfferDiscoveryOption = {
  slug: string;
  title: string;
  order: number;
};

export type CampOfferDiscoveryGroup = {
  slug: string;
  title: string;
  order: number;
  entityTypes: SignalEntityType[];
  options: CampOfferDiscoveryOption[];
};

export const CAMP_OFFER_DISCOVERY_GROUPS: CampOfferDiscoveryGroup[] = [
  {
    slug: "discovery-camp-experience",
    title: "Опыт ребёнка",
    order: 110,
    entityTypes: ["OFFER"],
    options: [
      { slug: "discovery-camp-experience-beginner-friendly", title: "Подходит новичкам", order: 1 },
      { slug: "discovery-camp-experience-no-experience-needed", title: "Можно без опыта", order: 2 },
      { slug: "discovery-camp-experience-basic-training-needed", title: "Нужна базовая подготовка", order: 3 },
    ],
  },
  {
    slug: "discovery-camp-group-format",
    title: "Формат группы",
    order: 120,
    entityTypes: ["OFFER"],
    options: [
      { slug: "discovery-camp-group-format-small-groups", title: "Малые группы", order: 1 },
      { slug: "discovery-camp-group-format-individual-approach", title: "Индивидуальный подход", order: 2 },
      { slug: "discovery-camp-group-format-with-friend", title: "Можно с другом", order: 3 },
    ],
  },
  {
    slug: "discovery-camp-program-pace",
    title: "Темп программы",
    order: 130,
    entityTypes: ["OFFER"],
    options: [
      { slug: "discovery-camp-program-pace-calm", title: "Спокойный темп", order: 1 },
      { slug: "discovery-camp-program-pace-active", title: "Активная программа", order: 2 },
      { slug: "discovery-camp-program-pace-intensive", title: "Интенсивная программа", order: 3 },
      { slug: "discovery-camp-program-pace-lots-of-movement", title: "Много движения", order: 4 },
    ],
  },
  {
    slug: "discovery-camp-logistics",
    title: "Быт и логистика",
    order: 140,
    entityTypes: ["OFFER"],
    options: [
      { slug: "discovery-camp-logistics-meals-included", title: "Питание включено", order: 1 },
      { slug: "discovery-camp-logistics-lunch-included", title: "Обед включён", order: 2 },
      { slug: "discovery-camp-logistics-snacks-included", title: "Перекусы включены", order: 3 },
      { slug: "discovery-camp-logistics-transfer", title: "Трансфер", order: 4 },
      { slug: "discovery-camp-logistics-accommodation", title: "Проживание", order: 5 },
    ],
  },
  {
    slug: "discovery-camp-safety",
    title: "Безопасность и комфорт",
    order: 150,
    entityTypes: ["OFFER"],
    options: [
      { slug: "discovery-camp-safety-medical-support", title: "Медицинское сопровождение", order: 1 },
      { slug: "discovery-camp-safety-experienced-teachers", title: "Педагоги с опытом", order: 2 },
      { slug: "discovery-camp-safety-first-camp-friendly", title: "Подходит для первого лагеря", order: 3 },
    ],
  },
  {
    slug: "discovery-camp-outcome",
    title: "Результат",
    order: 160,
    entityTypes: ["OFFER"],
    options: [
      { slug: "discovery-camp-outcome-new-skills", title: "Новые навыки", order: 1 },
      { slug: "discovery-camp-outcome-socialization", title: "Социализация", order: 2 },
      { slug: "discovery-camp-outcome-independence", title: "Развитие самостоятельности", order: 3 },
      { slug: "discovery-camp-outcome-creative-result", title: "Творческий результат", order: 4 },
      { slug: "discovery-camp-outcome-language-practice", title: "Языковая практика", order: 5 },
      { slug: "discovery-camp-outcome-sports-shape", title: "Спортивная форма", order: 6 },
    ],
  },
];

export const CAMP_OFFER_DISCOVERY_GROUP_SLUGS = CAMP_OFFER_DISCOVERY_GROUPS.map(
  (group) => group.slug,
);

export const CAMP_OFFER_DISCOVERY_PICKER_CONFIGS = [
  {
    slug: "discovery-camp-experience",
    title: "Опыт ребёнка",
    required: false,
  },
  {
    slug: "discovery-camp-group-format",
    title: "Формат группы",
    required: false,
  },
  {
    slug: "discovery-camp-program-pace",
    title: "Темп программы",
    required: false,
  },
  {
    slug: "discovery-camp-logistics",
    title: "Быт и логистика",
    required: false,
  },
  {
    slug: "discovery-camp-safety",
    title: "Безопасность и комфорт",
    required: false,
  },
  {
    slug: "discovery-camp-outcome",
    title: "Результат",
    required: false,
  },
] as const;
