/**
 * ImportFieldOverride checker
 *
 * Проверяет, разрешено ли обновлять конкретное поле Place или Activity
 * с учётом ImportFieldOverride записей.
 */

import prisma from "@/lib/prisma";
import type { ImportFieldLockMode } from "@prisma/client";

export interface FieldOverrideMap {
  /** fieldName → lockMode */
  [fieldName: string]: ImportFieldLockMode;
}

/**
 * Загрузить все overrides для конкретного Place.
 */
export async function loadFieldOverrides(placeId: string): Promise<FieldOverrideMap> {
  const overrides = await prisma.importFieldOverride.findMany({
    where: { entityType: "PLACE", entityId: placeId },
    select: { fieldName: true, lockMode: true },
  });
  return Object.fromEntries(overrides.map((o) => [o.fieldName, o.lockMode]));
}

/**
 * Загрузить все overrides для конкретного Activity.
 */
export async function loadActivityFieldOverrides(activityId: string): Promise<FieldOverrideMap> {
  const overrides = await prisma.importFieldOverride.findMany({
    where: { entityType: "EVENT", entityId: activityId },
    select: { fieldName: true, lockMode: true },
  });
  return Object.fromEntries(overrides.map((o) => [o.fieldName, o.lockMode]));
}

/**
 * Проверить, разрешено ли обновлять поле.
 *
 * Политика:
 *   LOCKED           → запрещено всегда
 *   PREFER_MANUAL    → запрещено (ручное значение приоритетнее)
 *   PREFER_IMPORT    → разрешено (import может перезаписать)
 *   (нет override)   → разрешено
 */
export function isFieldAllowed(
  fieldName: string,
  overrides: FieldOverrideMap,
): boolean {
  const lockMode = overrides[fieldName];
  if (!lockMode) return true;
  if (lockMode === "PREFER_IMPORT") return true;
  return false;
}

/**
 * Отфильтровать объект обновлений с учётом overrides.
 * Возвращает { allowed, skipped }.
 */
export function applyOverrideFilter<T extends Record<string, unknown>>(
  updates: T,
  overrides: FieldOverrideMap,
): { allowed: Partial<T>; skipped: string[] } {
  const allowed: Partial<T> = {};
  const skipped: string[] = [];

  for (const [field, value] of Object.entries(updates)) {
    if (isFieldAllowed(field, overrides)) {
      (allowed as Record<string, unknown>)[field] = value;
    } else {
      skipped.push(`${field} (locked: ${overrides[field]})`);
    }
  }

  return { allowed, skipped };
}
