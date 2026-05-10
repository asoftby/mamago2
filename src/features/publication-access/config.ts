import {
  CalendarCheck2,
  Clock3,
  ExternalLink,
  Info,
  PhoneCall,
  Ticket,
} from "lucide-react";
import type {
  PublicationAccessMethod,
  PublicationAccessMethodConfig,
} from "./types";

export const ACCESS_METHOD_CONFIG: Record<
  PublicationAccessMethod,
  PublicationAccessMethodConfig
> = {
  details: {
    title: "Узнать подробнее",
    description:
      "Пользователь увидит описание и сможет принять решение без отдельной записи",
    publicButtonLabel: "Подробнее",
    icon: Info,
  },
  ticket: {
    title: "Купить билет",
    description: "Пользователь перейдёт по ссылке для покупки билета",
    publicButtonLabel: "Купить билет",
    requiresUrl: true,
    urlField: "ticketUrl",
    icon: Ticket,
  },
  timeslots: {
    title: "Записаться по времени",
    description: "Пользователь выберет доступное время",
    publicButtonLabel: "Выбрать время",
    supportsTimeSlots: true,
    icon: Clock3,
  },
  prebooking: {
    title: "Предварительная запись",
    description: "Пользователь оставит заявку или свяжется для записи",
    publicButtonLabel: "Записаться",
    supportsPhone: true,
    supportsExternalUrl: true,
    icon: CalendarCheck2,
  },
  external: {
    title: "Перейти на сайт",
    description: "Пользователь перейдёт на внешний сайт",
    publicButtonLabel: "Перейти на сайт",
    requiresUrl: true,
    urlField: "externalUrl",
    icon: ExternalLink,
  },
  contact: {
    title: "Связаться",
    description: "Пользователь сможет связаться по телефону или инструкции",
    publicButtonLabel: "Связаться",
    icon: PhoneCall,
  },
};

