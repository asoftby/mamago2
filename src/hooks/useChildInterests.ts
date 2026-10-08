"use client";

import { useState, useEffect } from "react";

export interface ChildInterestOption {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
}

interface UseChildInterestsResult {
  interests: ChildInterestOption[];
  isLoading: boolean;
  error: string | null;
  /** Re-run the fetch (e.g. a user-triggered "Повторить" after a failure). */
  retry: () => void;
}

/**
 * Hook for fetching child interests from signals API
 * 
 * Single source of truth for child interests across:
 * - Onboarding flows
 * - Profile management
 * - My Plan
 * - Any child preference forms
 * 
 * Data source: SignalDefinition with slug="interests" from database
 */
export function useChildInterests(): UseChildInterestsResult {
  const [interests, setInterests] = useState<ChildInterestOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchInterests = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/public/signals/interests", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch interests");
        }

        const data = await response.json() as { options?: ChildInterestOption[] };

        if (cancelled) return;

        const options = data.options || [];
        setInterests(options);
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load child interests:", err);
        setError(err instanceof Error ? err.message : "Failed to load interests");
        setInterests([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchInterests();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => setAttempt((n) => n + 1);

  return { interests, isLoading, error, retry };
}

/**
 * Get interest label by value/slug
 */
export function getInterestLabel(
  interests: ChildInterestOption[],
  value: string
): string {
  const interest = interests.find((i) => i.value === value);
  return interest?.label || value;
}
