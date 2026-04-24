export function getTodayLabel() {
  const date = new Date();

  return {
    day: date.getDate(),
    month: date
      .toLocaleDateString("ru-RU", { month: "short" })
      .replace(".", ""),
  };
}

export function getWeekendLabel() {
  const now = new Date();
  const day = now.getDay();

  const diffToSaturday = day === 0 ? -1 : 6 - day;

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + diffToSaturday);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  return {
    days: `${saturday.getDate()}–${sunday.getDate()}`,
    month: saturday
      .toLocaleDateString("ru-RU", { month: "short" })
      .replace(".", ""),
  };
}
