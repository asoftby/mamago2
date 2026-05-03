"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";
import type { AuthenticatedAppUser } from "@/lib/auth/getCurrentAuthState";

export type AuthStatus = "guest" | "authenticated";

type AuthContextValue = {
  user: AuthenticatedAppUser | null;
  status: AuthStatus;
  isLoading: boolean;
  refetch: () => Promise<AuthenticatedAppUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthMe(): Promise<AuthenticatedAppUser | null> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as AuthenticatedAppUser;
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthenticatedAppUser | null;
}) {
  const [user, setUser] = useState<AuthenticatedAppUser | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>(
    initialUser ? "authenticated" : "guest",
  );
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextUser = await fetchAuthMe();
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "guest");
      return nextUser;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      void refetch();
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_STATE_CHANGED_EVENT, onAuthChanged);
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ user, status, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthState() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthState must be used within AuthProvider");
  }
  return context;
}
