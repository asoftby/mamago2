/**
 * Подстановка `{variable}` в строки шаблонов.
 * Неизвестные ключи остаются как `{key}` — удобно заметить опечатку в превью.
 */
export function applySeoTemplateString(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key: string) => {
    const v = values[key];
    return v !== undefined && v !== "" ? v : full;
  });
}

export function previewValuesFromDocs(
  overrides: Partial<Record<string, string>>,
): Record<string, string> {
  const base: Record<string, string> = {
    city: "Москва",
    dateLabel: "15 марта 2025",
    category: "Концерты",
    entityTitle: "Джазовый вечер",
  };
  const out: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
