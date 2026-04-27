import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { Container } from "@/components/ui/Container";
import { RoutesClient } from "./RoutesClient";

export const metadata = { title: "Мои маршруты — mamaGo" };

type UserRoute = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: string;
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
        select: { id: true, photoUrl: true },
        orderBy: { order: "asc" },
      },
    },
  });

  return routes.map((route) => ({
    id: route.id,
    slug: route.slug,
    title: route.title,
    ageTags: route.ageTags,
    budgetLevel: route.budgetLevel,
    status: route.status,
    stopsCount: route.stops.length,
    coverImageUrl:
      route.coverImageUrl ||
      route.stops.find((s) => s.photoUrl)?.photoUrl ||
      null,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  }));
}

export default async function RoutesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const routes = await getUserRoutes(user.id);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-6xl">
        <RoutesClient initialRoutes={routes} />
      </Container>
    </div>
  );
}
