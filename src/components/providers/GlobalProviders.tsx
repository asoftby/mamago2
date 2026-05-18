"use client";

import type { ReactNode } from "react";
import { AccountModeProvider } from "@/contexts/AccountModeContext";
import { NotificationStoreAuthSync } from "@/features/notifications/NotificationStoreAuthSync";
import { SaveIntentProvider } from "@/lib/save/SaveIntentContext";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import type { AuthenticatedAppUser } from "@/lib/auth/getCurrentAuthState";

export function GlobalProviders({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthenticatedAppUser | null;
}) {
  return (
    <SaveIntentProvider>
      <AuthProvider initialUser={initialUser}>
        <AccountModeProvider>
          <NotificationStoreAuthSync>{children}</NotificationStoreAuthSync>
        </AccountModeProvider>
      </AuthProvider>
    </SaveIntentProvider>
  );
}
