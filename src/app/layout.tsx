import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ntSomic } from "@/lib/fonts";
import { Sonner } from "@/components/ui/sonner";
import { AccountModeProvider } from "@/contexts/AccountModeContext";
import { FamilyPersonaProvider } from "@/contexts/FamilyPersonaContext";
import { FamilyDerivedAgeSync } from "@/components/family/FamilyDerivedAgeSync";
import { MyPlanProvider } from "@/components/MyPlanProvider";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { SaveIntentProvider } from "@/lib/save/SaveIntentContext";
import { resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { CityProvider } from "@/contexts/CityContext";
import { WeatherProvider } from "@/contexts/WeatherContext";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { getCurrentAuthState } from "@/lib/auth/getCurrentAuthState";
import { PendingActionProvider } from "@/contexts/PendingActionContext";
import { GateFlowController } from "@/components/auth/GateFlowController";
import { MobileTapDiagnostics } from "@/components/dev/MobileTapDiagnostics";

export const metadata: Metadata = {
  title: "mamaGo 2.0",
  description: "Next Generation City Guide",
};

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
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined;
  const currentSurface = resolveSurfaceFromHostAndPathname(host, "/");
  const shouldMountMyPlanProvider = currentSurface === "public";
  const initialAuthUser = await getCurrentAuthState();

  return (
    <html lang="ru" className={ntSomic.variable}>
      <body
        className="antialiased min-h-screen text-foreground"
      >
        <SaveIntentProvider>
          <AuthProvider initialUser={initialAuthUser}>
            <PendingActionProvider>
              <AccountModeProvider>
                <CityProvider>
                  <WeatherProvider>
                    <FamilyPersonaProvider>
                      <CookieConsentProvider>
                        <FamilyDerivedAgeSync />
                        {children}
                        {shouldMountMyPlanProvider ? <MyPlanProvider /> : null}
                        <GateFlowController />
                        <MobileTapDiagnostics />
                      </CookieConsentProvider>
                    </FamilyPersonaProvider>
                  </WeatherProvider>
                </CityProvider>
              </AccountModeProvider>
            </PendingActionProvider>
          </AuthProvider>
        </SaveIntentProvider>
        <Sonner />
      </body>
    </html>
  );
}
