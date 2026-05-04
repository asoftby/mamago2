/**
 * Helper для загрузки сигналов с поддержкой DEPRECATED опций
 * 
 * Логика:
 * 1. Загружает активные опции (для выбора новых)
 * 2. Загружает все опции (для отображения старых DEPRECATED значений)
 * 3. Объединяет их: все DEPRECATED значения из сохраненных - видны но disabled
 */

import type {
  DiscoverySignalGroup,
  DiscoverySignalOption,
} from "@/app/api/public/signals/discovery/route";
import type {
  ProfileSignalGroup,
  ProfileSignalOption,
} from "@/app/api/public/signals/profile/route";

export interface SignalWithStatus extends DiscoverySignalOption {
  canSelect: boolean; // можно выбрать (только для ACTIVE)
}

export interface SignalGroupWithStatus extends DiscoverySignalGroup {
  options: SignalWithStatus[];
}

/**
 * Загружает DISCOVERY сигналы для формы
 * @param entityType - тип сущности (PLACE, EVENT, OFFER)
 * @param savedIds - ID сохраненных значений (может быть из DB)
 * @returns Группы сигналов с флагом canSelect
 */
export async function loadDiscoverySignals(
  entityType: "PLACE" | "EVENT" | "OFFER" | "ROUTE" | "ARTICLE",
  savedIds: string[] = []
): Promise<SignalGroupWithStatus[]> {
  try {
    const [activeResponse, deprecatedResponse] = await Promise.all([
      // Загружаем активные опции (для новых выборов)
      fetch(
        `/api/public/signals/discovery?entityType=${entityType}&includeDeprecated=false`
      ).then((r) => (r.ok ? r.json() : Promise.reject())),
      // Загружаем все опции (для отображения старых)
      fetch(
        `/api/public/signals/discovery?entityType=${entityType}&includeDeprecated=true`
      ).then((r) => (r.ok ? r.json() : Promise.reject())),
    ]);

    const activeGroups: DiscoverySignalGroup[] = activeResponse.groups ?? [];
    const deprecatedGroups: DiscoverySignalGroup[] = deprecatedResponse.groups ?? [];

    // Создаем map всех опций с информацией о статусе
    const allOptionsMap = new Map<string, { option: DiscoverySignalOption; active: boolean }>();

    deprecatedGroups.forEach((group) => {
      group.options.forEach((opt) => {
        allOptionsMap.set(opt.id, { option: opt, active: opt.active });
      });
    });

    // Объединяем: используем все опции из deprecated, но флаг canSelect только для active
    const result: SignalGroupWithStatus[] = deprecatedGroups.map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      icon: group.icon,
      order: group.order,
      options: group.options.map((opt) => ({
        ...opt,
        canSelect: opt.active, // только ACTIVE можно выбирать
      })),
    }));

    return result;
  } catch (error) {
    console.error("[loadDiscoverySignals]", error);
    return [];
  }
}

/**
 * Загружает PROFILE сигналы для формы
 * @param savedIds - ID сохраненных значений (может быть из DB)
 * @returns Группы сигналов с флагом canSelect
 */
export async function loadProfileSignals(
  savedIds: string[] = []
): Promise<SignalGroupWithStatus[]> {
  try {
    const [activeResponse, deprecatedResponse] = await Promise.all([
      // Загружаем активные опции (для новых выборов)
      fetch("/api/public/signals/profile?includeDeprecated=false").then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
      // Загружаем все опции (для отображения старых)
      fetch("/api/public/signals/profile?includeDeprecated=true").then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
    ]);

    const deprecatedGroups: ProfileSignalGroup[] = deprecatedResponse.groups ?? [];

    // Объединяем: используем все опции из deprecated, но флаг canSelect только для active
    const result: SignalGroupWithStatus[] = deprecatedGroups.map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      icon: group.icon,
      order: group.order,
      options: (group.options as ProfileSignalOption[]).map((opt) => ({
        ...opt,
        canSelect: opt.active, // только ACTIVE можно выбирать
      })),
    }));

    return result;
  } catch (error) {
    console.error("[loadProfileSignals]", error);
    return [];
  }
}

/**
 * Объединяет опции из разных источников для отображения
 * Используется, когда нужно показать и ACTIVE и DEPRECATED вместе
 */
export function mergeSignalOptions(
  active: DiscoverySignalOption[],
  deprecated: DiscoverySignalOption[]
): SignalWithStatus[] {
  const map = new Map<string, SignalWithStatus>();

  // Сначала добавляем deprecated (они будут перезаписаны если есть active с тем же id)
  deprecated.forEach((opt) => {
    map.set(opt.id, { ...opt, canSelect: false });
  });

  // Потом добавляем/перезаписываем active
  active.forEach((opt) => {
    map.set(opt.id, { ...opt, canSelect: true });
  });

  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}
