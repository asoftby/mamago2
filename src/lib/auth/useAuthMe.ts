"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";

export type AuthMeUser = {
  id: string;
  email?: string;
  role?: string;
  emailVerifiedAt?: string | null;
};

export function useAuthMe() {
  const [user, setUser] = useState<AuthMeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as AuthMeUser;
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

  useEffect(() => {
    const onAuthChanged = () => {
      void refetch();
    };
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_STATE_CHANGED_EVENT, onAuthChanged);
  }, [refetch]);

  const isAuthenticated = !loading && user !== null;

  const isEmailVerified =
    user?.emailVerifiedAt != null && user.emailVerifiedAt !== "";

  return {
    user,
    isAuthenticated,
    isLoading: loading,
    isEmailVerified,
    refetch,
  };
}
