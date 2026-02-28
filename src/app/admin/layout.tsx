import React from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="w-60 border-r p-4 space-y-3">
          <div className="font-semibold mb-4">mamaGo Admin</div>

          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/">Dashboard</Link>
            <Link href="/taxonomy/signals">Signals</Link>
            <Link href="/taxonomy/districts">Districts</Link>
            <Link href="/taxonomy/metro-stations">Metro Stations</Link>
            <Link href="/discovery/filters">Filters</Link>
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
