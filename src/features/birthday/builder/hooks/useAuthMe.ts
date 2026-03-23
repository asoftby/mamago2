"use client";

import { useCallback, useEffect, useState } from "react";

type AuthUser = { id: string; role?: string };

export function useAuthMe() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as AuthUser;
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const isAuthenticated = !loading && user !== null;

  return {
    user,
    isAuthenticated,
    isLoading: loading,
    refetch,
  };
}
