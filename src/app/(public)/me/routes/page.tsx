import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { Container } from "@/components/ui/Container";
import { RoutesClient } from "./RoutesClient";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";

export const metadata = { title: "Мои маршруты — mamaGo" };

type UserRoute = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: string;
  budgetLabel: string;
  status: string;
  stopsCount: number;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

async function getUserRoutes(userId: string): Promise<UserRoute[]> {
  const routes = await prisma.route.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      stops: {
        select: {
          id: true,
          photoUrl: true,
          priceType: true,
          priceMin: true,
          priceMax: true,
          priceCurrency: true,
          priceNote: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  return routes.map((route) => {
    const budgetSummary = summarizeRouteBudget(route.stops);

    return {
      id: route.id,
      slug: route.slug,
      title: route.title,
      ageTags: route.ageTags,
      budgetLevel: route.budgetLevel,
      budgetLabel: budgetSummary.label,
      status: route.status,
      stopsCount: route.stops.length,
      coverImageUrl:
        route.coverImageUrl ||
        route.stops.find((s) => s.photoUrl)?.photoUrl ||
        null,
      createdAt: route.createdAt.toISOString(),
      updatedAt: route.updatedAt.toISOString(),
    };
  });
}

export default async function RoutesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const routes = await getUserRoutes(user.id);

  return (
    <div className="min-h-screen bg-[#FCFBF8]">
      <Container className="max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8 lg:px-8 lg:pt-10">
        <RoutesClient initialRoutes={routes} />
      </Container>
    </div>
  );
}
