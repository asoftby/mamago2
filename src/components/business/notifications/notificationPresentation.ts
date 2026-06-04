export function getNotificationIcon(type: string): string {
  if (type === "WELCOME") return "🎉";

  switch (type) {
    case "BOOKING_CREATED":
    case "BOOKING_REQUEST":
      return "📋";
    case "PLACE_APPROVED":
    case "CONTENT_PUBLISHED":
      return "✅";
    case "PLACE_NEEDS_CHANGES":
    case "BUSINESS_ACTION_REQUIRED":
      return "⚠️";
    case "PLACE_REJECTED":
    case "CONTENT_REJECTED":
      return "❌";
    case "BUSINESS_NEWS":
    case "NEWS":
      return "📰";
    case "ANNOUNCEMENT":
    case "SYSTEM_INFO":
      return "📣";
    default:
      return "📢";
  }
}

export function getNotificationTypeLabel(type: string): string {
  switch (type) {
    case "BOOKING_CREATED":
    case "BOOKING_REQUEST":
      return "Заявки";
    case "PLACE_APPROVED":
    case "PLACE_NEEDS_CHANGES":
    case "PLACE_REJECTED":
    case "CONTENT_PUBLISHED":
    case "CONTENT_REJECTED":
      return "Публикации";
    case "BUSINESS_ACTION_REQUIRED":
      return "Требует действия";
    case "BUSINESS_NEWS":
    case "NEWS":
      return "Новости";
    case "ANNOUNCEMENT":
    case "SYSTEM_INFO":
      return "Объявление";
    case "WELCOME":
      return "Сервис";
    default:
      return "Уведомление";
  }
}
