import React from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicFooter } from "@/components/shell/PublicFooter";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-64px)]">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}
