import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ntSomic, ptSerif } from "@/lib/fonts";
import { Sonner } from "@/components/ui/sonner";
import { AccountModeProvider } from "@/contexts/AccountModeContext";
import { SaveIntentProvider } from "@/lib/save/SaveIntentContext";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { getCurrentAuthState } from "@/lib/auth/getCurrentAuthState";
import { PendingActionProvider } from "@/contexts/PendingActionContext";
import { GateFlowController } from "@/components/auth/GateFlowController";
import { LogoutSuccessListener } from "@/components/auth/LogoutSuccessListener";
import { MobileTapDiagnostics } from "@/components/dev/MobileTapDiagnostics";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { getBrandingConfig } from "@/lib/branding";
import {
  BRANDING_FAVICON_MIME_TYPE,
  getBrandingFaviconRouteHref,
} from "@/lib/brandingFavicon";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

export const metadata: Metadata = applyGlobalRobotsOverride({
  title: "mamaGo 2.0",
  description: "Next Generation City Guide",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialAuthUser, branding] = await Promise.all([
    getCurrentAuthState(),
    getBrandingConfig(),
  ]);
  const faviconHref = getBrandingFaviconRouteHref(branding);

  return (
    <html lang="ru" className={`${ntSomic.variable} ${ptSerif.variable}`}>
      <head>
        <style>{`
          :root {
            --color-primary: ${branding.colorPrimary};
            --color-accent: ${branding.colorAccent};
            --color-background: ${branding.colorBackground};
            --color-surface: ${branding.colorSurface};
            --color-text: ${branding.colorText};
            --font-heading: ${branding.fontHeading};
            --font-body: ${branding.fontBody};
          }
        `}</style>
        <link
          rel="icon"
          href={faviconHref}
          type={BRANDING_FAVICON_MIME_TYPE}
          sizes="any"
          data-branding-favicon="true"
        />
        <link
          rel="shortcut icon"
          href={faviconHref}
          type={BRANDING_FAVICON_MIME_TYPE}
          sizes="any"
          data-branding-favicon="true"
        />
      </head>
      <body
        className="antialiased min-h-screen text-foreground"
      >
        <BrandingProvider logoUrl={branding.logoUrl}>
          <SaveIntentProvider>
            <AuthProvider initialUser={initialAuthUser}>
              <PendingActionProvider>
                <AccountModeProvider>
                  {children}
                  <GateFlowController />
                  <MobileTapDiagnostics />
                  <Suspense fallback={null}>
                    <LogoutSuccessListener />
                  </Suspense>
                </AccountModeProvider>
              </PendingActionProvider>
            </AuthProvider>
          </SaveIntentProvider>
        </BrandingProvider>
        <Sonner />
      </body>
    </html>
  );
}
