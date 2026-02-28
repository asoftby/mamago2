import { notFound } from "next/navigation";
import { parseDiscoveryState } from "@/lib/discovery/urlState";
import { getActivityFeed } from "@/server/discovery/getActivityFeed";
import prisma from "@/lib/prisma";
import { getMetroStations } from "@/server/geo/getMetroStations";
import { getDistricts } from "@/server/geo/getDistricts";
import { CityIntentShell } from "./CityIntentShell";
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

  // 2. Load active filters
  const definitions = await prisma.filterDefinition.findMany({
    where: { isActive: true, placement: { not: "HIDDEN" } },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" }
      }
    },
    orderBy: { orderIndex: "asc" }
  });

  // 3. Load geo options
  const metroStations = await getMetroStations(city.id);
  const districts = await getDistricts(city.id);

  const metroOptions = metroStations.map(m => ({ value: m.id, label: m.name }));
  const districtOptions = districts.map(d => ({ value: d.id, label: d.name }));

  // 4. Load feed (using existing helper for now, passing intent later if needed)
  // Currently getActivityFeed handles state parsing but we might want to pass intent explicitly if getActivityFeed supports it
  // For now, let's just use what we have.
  
  return (
    <>
      <div className="text-xs text-red-500 fixed top-0 left-0 z-[9999] bg-white px-2">
        CITY_SHELL_V2: {intent === "kuda" ? "go" : intent}
      </div>
      <CityIntentShell 
        city={citySlug} 
        intent={intent}
        definitions={definitions}
        metroOptions={metroOptions}
        districtOptions={districtOptions}
      />
    </>
  );
}
