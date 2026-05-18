"use client";

import type { ReactNode } from "react";
import { FamilyPersonaProvider } from "@/contexts/FamilyPersonaContext";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { CityProvider } from "@/contexts/CityContext";
import { UnreadNotificationCountProvider } from "@/contexts/UnreadNotificationCountContext";

export function PublicProviders({ children }: { children: ReactNode }) {
  return (
    <UnreadNotificationCountProvider>
      <CityProvider>
        <FamilyPersonaProvider>
          <CookieConsentProvider>{children}</CookieConsentProvider>
        </FamilyPersonaProvider>
      </CityProvider>
    </UnreadNotificationCountProvider>
  );
}
