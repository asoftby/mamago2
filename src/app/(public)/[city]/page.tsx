import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CityHomePage from "@/features/city-home/pages/CityHomePage";
import { buildCityHubMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return cities.map((c) => ({ city: c.slug }));
}

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  return applyGlobalRobotsOverride(await buildCityHubMetadata(citySlug));
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  await searchParams;

  const city = await prisma.city.findFirst({
    where: { slug: citySlug.toLowerCase(), isActive: true },
    select: { slug: true },
  });

  if (!city) notFound();

  return <CityHomePage citySlug={city.slug} />;
}
