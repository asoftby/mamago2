import type { Metadata, Viewport } from "next";
import { Manrope, Geist_Mono, Literata, Noto_Serif, PT_Serif } from "next/font/google";
import "./globals.css";
import { Sonner } from "@/components/ui/sonner";
import { AccountModeProvider } from "@/contexts/AccountModeContext";
import { FamilyPersonaProvider } from "@/contexts/FamilyPersonaContext";
import { FamilyDerivedAgeSync } from "@/components/family/FamilyDerivedAgeSync";
import { MyPlanProvider } from "@/components/MyPlanProvider";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { SaveIntentProvider } from "@/lib/save/SaveIntentContext";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-serif",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${manrope.variable} ${geistMono.variable} ${literata.variable} ${notoSerif.variable} ${ptSerif.variable} antialiased font-sans min-h-screen text-foreground`}
      >
        <SaveIntentProvider>
          <AccountModeProvider>
            <FamilyPersonaProvider>
              <CookieConsentProvider>
                <FamilyDerivedAgeSync />
                {children}
                <MyPlanProvider />
              </CookieConsentProvider>
            </FamilyPersonaProvider>
          </AccountModeProvider>
        </SaveIntentProvider>
        <Sonner />
      </body>
    </html>
  );
}
