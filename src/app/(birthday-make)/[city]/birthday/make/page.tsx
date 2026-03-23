import { Suspense } from "react";
import { BirthdayBuilderShell } from "@/features/birthday/builder/components/BirthdayBuilderShell";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ city: string }>;
}

export const metadata: Metadata = {
  title: "Собрать праздник — mamaGo",
  description: "Выберите площадку, развлечения, торт и декор для детского дня рождения",
};

export default async function BirthdayMakePage({ params }: PageProps) {
  const { city: citySlug } = await params;

  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal header: back to feed */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-border/60 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/${citySlug}/birthday`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            К ленте
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <Suspense fallback={null}>
          <BirthdayBuilderShell />
        </Suspense>
      </div>
    </div>
  );
}
