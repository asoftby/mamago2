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
import { getBrandingConfig } from "@/lib/branding";

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
  const [initialAuthUser, branding] = await Promise.all([
    getCurrentAuthState(),
    getBrandingConfig(),
  ]);

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
        <link rel="icon" href={branding.faviconUrl ?? "/favicon.ico"} />
      </head>
      <body
        className="antialiased min-h-screen text-foreground"
      >
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
        <Sonner />
      </body>
    </html>
  );
}
