import type { Metadata, Viewport } from "next";
import { Geist_Mono, Literata, Noto_Serif, PT_Serif } from "next/font/google";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "700"],
});

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

  return (
    <html lang="ru" className={ntSomic.variable}>
      <body
        className={`${geistMono.variable} ${literata.variable} ${notoSerif.variable} ${ptSerif.variable} antialiased min-h-screen text-foreground`}
      >
        <SaveIntentProvider>
          <AccountModeProvider>
            <CityProvider>
              <WeatherProvider>
                <FamilyPersonaProvider>
                  <CookieConsentProvider>
                    <FamilyDerivedAgeSync />
                    {children}
                    {shouldMountMyPlanProvider ? <MyPlanProvider /> : null}
                  </CookieConsentProvider>
                </FamilyPersonaProvider>
              </WeatherProvider>
            </CityProvider>
          </AccountModeProvider>
        </SaveIntentProvider>
        <Sonner />
      </body>
    </html>
  );
}
