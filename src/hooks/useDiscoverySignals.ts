import { useEffect, useState } from "react";
import type { SignalEntityType } from "@prisma/client";

export type DiscoverySignalGroup = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  order: number;
  options: DiscoverySignalOption[];
};

export type DiscoverySignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
};

/**
 * Hook для загрузки DISCOVERY сигналов с фильтрацией по entity type
 * 
 * @param entityType - тип сущности (PLACE, EVENT, OFFER, ROUTE, ARTICLE)
 * @returns groups - массив групп сигналов с опциями
 * @returns isLoading - флаг загрузки
 * @returns error - ошибка загрузки
 */
export function useDiscoverySignals(entityType: SignalEntityType) {
  const [groups, setGroups] = useState<DiscoverySignalGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSignals() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/public/signals/discovery?entityType=${entityType}`);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch signals: ${res.status}`);
        }

        const data = await res.json();
        
        if (!cancelled) {
          setGroups(data.groups || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useDiscoverySignals] Error:", err);
          setError(err instanceof Error ? err.message : "Failed to load signals");
          setGroups([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchSignals();

    return () => {
      cancelled = true;
    };
  }, [entityType]);

  return { groups, isLoading, error };
}
