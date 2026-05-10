import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ntSomic } from "@/lib/fonts";
import { Sonner } from "@/components/ui/sonner";
import { getCurrentAuthState } from "@/lib/auth/getCurrentAuthState";
import { GlobalProviders } from "@/components/providers/GlobalProviders";

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
    <html lang="ru" className={ntSomic.variable}>
      <body
        className="antialiased min-h-screen text-foreground"
      >
        <GlobalProviders initialUser={initialAuthUser}>{children}</GlobalProviders>
        <Sonner />
      </body>
    </html>
  );
}
