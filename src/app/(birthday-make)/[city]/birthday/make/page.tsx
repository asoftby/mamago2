import { Suspense } from "react";
import { BirthdayBuilderShell } from "@/features/birthday/builder/components/BirthdayBuilderShell";
import { notFound } from "next/navigation";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ city: string }>;
}

export const metadata: Metadata = {
  title: "Конструктор праздника — mamaGo",
  description: "Выберите площадку, развлечения, торт и декор для детского дня рождения",
};

export default async function BirthdayMakePage({ params }: PageProps) {
  const { city: citySlug } = await params;

  const city = await findCityBySlug(citySlug);
  if (!city) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <Suspense fallback={null}>
        <BirthdayBuilderShell citySlug={citySlug} />
      </Suspense>
    </div>
  );
}
