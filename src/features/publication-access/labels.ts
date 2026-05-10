import type {
  PublicationAccessLabels,
  PublicationEntityType,
} from "./types";

export const PUBLICATION_ACCESS_LABELS: Record<
  PublicationEntityType,
  PublicationAccessLabels
> = {
  event: {
    sectionTitle: "Как попасть на событие?",
    sectionDescription: "Выберите основной способ участия для пользователя",
    previewTitle: "Как это увидит пользователь",
    instructionsLabel: "Дополнительные условия участия",
  },
  offer: {
    sectionTitle: "Как воспользоваться предложением?",
    sectionDescription:
      "Выберите, как пользователь сможет получить или оформить предложение",
    previewTitle: "Как это увидит пользователь",
    instructionsLabel: "Дополнительные условия получения",
  },
  place: {
    sectionTitle: "Как попасть?",
    sectionDescription: "Укажите, нужна ли запись или дополнительные действия",
    previewTitle: "Как это увидит пользователь",
    instructionsLabel: "Дополнительные условия посещения",
  },
  route: {
    sectionTitle: "Как пройти маршрут?",
    sectionDescription: "Укажите, нужны ли билеты, бронь или подготовка",
    previewTitle: "Как это увидит пользователь",
    instructionsLabel: "Дополнительные условия маршрута",
  },
};

