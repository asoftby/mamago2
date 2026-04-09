import { PublicationStatus, PublicationType } from "@/lib/publications/domain";

export const PUBLICATION_STATUS_LABEL: Record<
  (typeof PublicationStatus)[keyof typeof PublicationStatus],
  string
> = {
  [PublicationStatus.DRAFT]: "Черновик",
  [PublicationStatus.PENDING]: "На модерации",
  [PublicationStatus.PUBLISHED]: "Опубликовано",
  [PublicationStatus.REJECTED]: "Отклонено",
  [PublicationStatus.SCHEDULED]: "Запланировано",
  [PublicationStatus.ARCHIVED]: "В архиве",
};

export const PUBLICATION_TYPE_LABEL: Record<
  (typeof PublicationType)[keyof typeof PublicationType],
  string
> = {
  [PublicationType.ARTICLE]: "Статья",
  [PublicationType.NEWS]: "Новость",
  [PublicationType.COLLECTION]: "Подборка",
};
