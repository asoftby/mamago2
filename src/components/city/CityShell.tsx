import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { CityDiscoveryShell } from "./CityDiscoveryShell";
import { Intent } from "@/lib/intent";

interface CityShellProps {
  citySlug: string;
  intent: Intent;
  searchParams: Record<string, string | string[] | undefined>;
}

export async function CityShell({ citySlug, intent, searchParams }: CityShellProps) {
  // 1. Check city
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) notFound();

  // Note: Filter options are now loaded client-side via API in DiscoveryFilters
  // This reduces server-side data fetching and improves performance
  
  return (
    <CityDiscoveryShell 
      city={citySlug} 
      intent={intent}
    />
  );
}
