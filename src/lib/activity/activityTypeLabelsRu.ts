/** Короткие подписи типа активности для UI (совпадает с Prisma `ActivityType`). */
export function activityTypeLabelRu(type: string): string {
  const map: Record<string, string> = {
    EVENT: "Событие",
    PERMANENT: "Место",
    COURSE: "Занятие",
    ROUTE: "Маршрут",
    OFFER: "Предложение",
  };
  return map[type] ?? type;
}
