"use client";

import { useAuthState } from "@/lib/auth/AuthProvider";

export type AuthMeUser = {
  id: string;
  email?: string;
  role?: string;
  emailVerifiedAt?: string | null;
};

export function useAuthMe() {
  const { user, status, isLoading, refetch } = useAuthState();
  const isAuthenticated = status === "authenticated";

  const isEmailVerified =
    user?.emailVerifiedAt != null && user.emailVerifiedAt !== "";

  return {
    user,
    status,
    isAuthenticated,
    isLoading,
    isEmailVerified,
    refetch,
  };
}
