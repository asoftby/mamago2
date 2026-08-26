import React, { Suspense } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteHeader } from "@/components/site/header";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { buildOrganizationJsonLd } from "@/lib/seo/schema/buildOrganizationJsonLd";
import { buildWebSiteJsonLd } from "@/lib/seo/schema/buildWebSiteJsonLd";
import { getPublicSocialLinks } from "@/lib/site/publicSocialLinks";
import { PublicLayoutBody } from "./PublicLayoutBody";
import { HeaderDiscoveryFiltersProviderWrapper } from "./HeaderDiscoveryFiltersProviderWrapper";
import { PublicationIntentProvider } from "@/contexts/PublicationIntentContext";
import { ArticleGeoLabelProvider } from "@/contexts/ArticleGeoLabelContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";
import { ReloadProbe } from "@/components/dev/ReloadProbe";
import { PublicProviders } from "@/components/providers/PublicProviders";
import { FamilyDerivedAgeSync } from "@/components/family/FamilyDerivedAgeSync";
import { MyPlanProvider } from "@/components/MyPlanProvider";
import { BetaTip } from "@/components/shared/BetaTip";
import { DiscoveryBudgetProvider } from "@/features/filters/discovery/discoveryBudgetContext";
import { getExternalAnalyticsConfig } from "@/server/services/analytics/externalAnalyticsConfig";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publicBase = getCanonicalPublicAppUrl();
  const sameAs = getPublicSocialLinks().map((link) => link.href);
  const organizationJsonLd = buildOrganizationJsonLd({
    publicBase,
    sameAs,
  });
  const webSiteJsonLd = buildWebSiteJsonLd({
    publicBase,
  });
  const externalAnalytics = getExternalAnalyticsConfig();

  return (
    <PublicProviders externalAnalytics={externalAnalytics}>
      <RefinementFiltersProvider>
        <ReloadProbe />
        <PublicationIntentProvider>
          <ArticleGeoLabelProvider>
            <HeaderDiscoveryFiltersProviderWrapper>
              <DiscoveryBudgetProvider>
                <div className="flex min-h-screen flex-col bg-background">
                  <JsonLd data={[organizationJsonLd, webSiteJsonLd]} />
                  <SiteHeader />

                  <PublicLayoutBody>{children}</PublicLayoutBody>
                  <FamilyDerivedAgeSync />
                  <MyPlanProvider />
                  <BetaTip />

                  {/* Global Refinement Modal */}
                  <Suspense fallback={null}>
                    <RefinementFiltersModalGlobal />
                  </Suspense>
                </div>
              </DiscoveryBudgetProvider>
            </HeaderDiscoveryFiltersProviderWrapper>
          </ArticleGeoLabelProvider>
        </PublicationIntentProvider>
      </RefinementFiltersProvider>
    </PublicProviders>
  );
}
