import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import FreshDeploySetupNotice from "@/components/site/FreshDeploySetupNotice";

export const dynamic = "force-dynamic";

async function resolveDefaultCitySlug(): Promise<string | null> {
  try {
    const minsk = await prisma.city.findUnique({
      where: { slug: "minsk" },
      select: { slug: true },
    });
    if (minsk) {
      return minsk.slug;
    }

    const firstCity = await prisma.city.findFirst({
      orderBy: { name: "asc" },
      select: { slug: true },
    });

    return firstCity?.slug ?? null;
  } catch (error) {
    console.warn("[root] city lookup failed:", error);
    return null;
  }
}

export default async function RootPage() {
  const citySlug = await resolveDefaultCitySlug();

  if (citySlug) {
    redirect(`/${citySlug}`);
  }

  return <FreshDeploySetupNotice />;
}
