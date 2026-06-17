function isEmptyObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

export function cleanJsonLd(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => cleanJsonLd(item))
      .filter((item) => item !== undefined && !isEmptyObject(item));

    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof value === "object") {
    const cleanedEntries = Object.entries(value).flatMap(([key, entryValue]) => {
      const cleanedValue = cleanJsonLd(entryValue);
      if (cleanedValue === undefined || isEmptyObject(cleanedValue)) return [];
      return [[key, cleanedValue] as const];
    });

    if (cleanedEntries.length === 0) return undefined;
    return Object.fromEntries(cleanedEntries);
  }

  return undefined;
}
