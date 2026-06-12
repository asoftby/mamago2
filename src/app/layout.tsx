import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ntSomic, ptSerif } from "@/lib/fonts";
import { Sonner } from "@/components/ui/sonner";
import { AccountModeProvider } from "@/contexts/AccountModeContext";
import { SaveIntentProvider } from "@/lib/save/SaveIntentContext";
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
  const initialAuthUser = await getCurrentAuthState();

  return (
    <html lang="ru" className={`${ntSomic.variable} ${ptSerif.variable}`}>
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
              </AccountModeProvider>
            </PendingActionProvider>
          </AuthProvider>
        </SaveIntentProvider>
        <Sonner />
      </body>
    </html>
  );
}
