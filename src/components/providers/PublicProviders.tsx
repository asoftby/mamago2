"use client";

import type { ReactNode } from "react";
import { FamilyPersonaProvider } from "@/contexts/FamilyPersonaContext";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { CityProvider } from "@/contexts/CityContext";
import { UnreadNotificationCountProvider } from "@/contexts/UnreadNotificationCountContext";
import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";

export function PublicProviders({
  children,
  externalAnalytics,
}: {
  children: ReactNode;
  externalAnalytics: ExternalAnalyticsConfig;
}) {
  return (
    <UnreadNotificationCountProvider>
      <CityProvider>
        <FamilyPersonaProvider>
          <CookieConsentProvider externalAnalytics={externalAnalytics}>
            {children}
          </CookieConsentProvider>
        </FamilyPersonaProvider>
      </CityProvider>
    </UnreadNotificationCountProvider>
  );
}
