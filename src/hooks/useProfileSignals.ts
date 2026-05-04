import { useEffect, useState } from "react";

export type ProfileSignalGroup = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  order: number;
  options: ProfileSignalOption[];
};

export type ProfileSignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
};

/**
 * Hook для загрузки PROFILE сигналов
 * 
 * @returns groups - массив групп сигналов с опциями
 * @returns isLoading - флаг загрузки
 * @returns error - ошибка загрузки
 */
export function useProfileSignals() {
  const [groups, setGroups] = useState<ProfileSignalGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSignals() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch("/api/public/signals/profile");
        
        if (!res.ok) {
          throw new Error(`Failed to fetch signals: ${res.status}`);
        }

        const data = await res.json();
        
        if (!cancelled) {
          setGroups(data.groups || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useProfileSignals] Error:", err);
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
  }, []);

  return { groups, isLoading, error };
}
