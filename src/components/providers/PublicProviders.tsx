"use client";

import type { ReactNode } from "react";
import { FamilyPersonaProvider } from "@/contexts/FamilyPersonaContext";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { CityProvider } from "@/contexts/CityContext";
import { WeatherProvider } from "@/contexts/WeatherContext";
import { PendingActionProvider } from "@/contexts/PendingActionContext";
import { UnreadNotificationCountProvider } from "@/contexts/UnreadNotificationCountContext";

export function PublicProviders({ children }: { children: ReactNode }) {
  return (
    <UnreadNotificationCountProvider>
      <PendingActionProvider>
        <CityProvider>
          <WeatherProvider>
            <FamilyPersonaProvider>
              <CookieConsentProvider>
                {children}
              </CookieConsentProvider>
            </FamilyPersonaProvider>
          </WeatherProvider>
        </CityProvider>
      </PendingActionProvider>
    </UnreadNotificationCountProvider>
  );
}
