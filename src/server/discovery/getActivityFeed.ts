import prisma from "@/lib/prisma";
import { DiscoveryState } from "@/lib/discovery/urlState";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import type { Prisma } from "@prisma/client";

export async function getActivityFeed(citySlug: string, state: DiscoveryState) {
  // 1. Find city
  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
  });

  if (!city) {
    return null;
  }

  // 2. Build where clause
  const andParts: Prisma.ActivityWhereInput[] = [{ cityId: city.id }];

  // Intent filtering (future implementation, e.g. category based)
  // For now, assume 'go' shows all, or map intent to categories.
  if (state.intent === "edu") {
    // example: where.category = "education"
  }

  // Context Filters
  // filters: { age: ['0-3', '3-5'], when: ['weekend'] }
  // We need to find activities that have ActivityFilterOption with:
  // filterDefinition.slug = key AND filterOption.value IN values
  
  if (Object.keys(state.filters).length > 0) {
    andParts.push(
      ...Object.entries(state.filters).map(([key, values]) => ({
        filterOptions: {
          some: {
            filterOption: {
              filter: { slug: key },
              value: { in: values },
            },
          },
        },
      }))
    );
  }

  const publicListing = getPublicListingActivityWhere();
  const publicAnd = publicListing.AND;
  if (publicAnd) {
    const pubParts = Array.isArray(publicAnd) ? publicAnd : [publicAnd];
    andParts.push(...pubParts);
  }

  const where = { AND: andParts };

  // 3. Fetch activities
  const activities = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20, // Pagination later
    include: {
      metroStation: true,
      filterOptions: {
        include: {
          filterOption: {
            include: {
              filter: true
            }
          }
        }
      }
    }
  });

  return {
    city,
    activities,
  };
}
