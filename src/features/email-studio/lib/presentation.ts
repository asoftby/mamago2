import type { EmailTemplateStatus, EmailTemplateType } from "./domain";

export type EmailTemplateClassification = "TRANSACTIONAL" | "BROADCAST" | "NOTIFICATION";

export function getEmailTemplateTypeLabel(type: EmailTemplateType): string {
  switch (type) {
    case "WELCOME":
      return "Welcome";
    case "VERIFY_EMAIL":
      return "Verify email";
    case "RESET_PASSWORD":
      return "Reset password";
    case "PLAN_REMINDER":
      return "Plan reminder";
    case "WEEKLY_DIGEST":
      return "Weekly digest";
    case "PROMO_CAMPAIGN":
      return "Promo campaign";
    case "CUSTOM":
      return "Custom";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

export function getEmailTemplateTypeRuLabel(type: EmailTemplateType): string {
  switch (type) {
    case "WELCOME":
      return "Приветственное письмо";
    case "VERIFY_EMAIL":
      return "Подтверждение email";
    case "RESET_PASSWORD":
      return "Сброс пароля";
    case "PLAN_REMINDER":
      return "Напоминание о плане";
    case "WEEKLY_DIGEST":
      return "Еженедельный дайджест";
    case "PROMO_CAMPAIGN":
      return "Промо-кампания";
    case "CUSTOM":
      return "Кастомный шаблон";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

export function getEmailTemplateClassification(
  type: EmailTemplateType,
): EmailTemplateClassification {
  switch (type) {
    case "WELCOME":
    case "VERIFY_EMAIL":
    case "RESET_PASSWORD":
      return "TRANSACTIONAL";
    case "PLAN_REMINDER":
      return "NOTIFICATION";
    case "WEEKLY_DIGEST":
    case "PROMO_CAMPAIGN":
    case "CUSTOM":
      return "BROADCAST";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

export function getEmailTemplateClassificationLabel(
  classification: EmailTemplateClassification,
): string {
  switch (classification) {
    case "TRANSACTIONAL":
      return "Transactional";
    case "BROADCAST":
      return "Broadcast";
    case "NOTIFICATION":
      return "Notification";
    default: {
      const neverClassification: never = classification;
      return neverClassification;
    }
  }
}

export function getEmailTemplateStatusDescription(status: EmailTemplateStatus): string {
  switch (status) {
    case "DRAFT":
      return "Можно редактировать и готовить к публикации";
    case "PUBLISHED":
      return "Готов к использованию в реальных отправках";
    case "ARCHIVED":
      return "Скрыт из активной работы, но сохранён в истории";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}
