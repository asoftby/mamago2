import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  listPlanItemsByWeek,
  groupPlanItemsByDate,
  getCurrentWeekStart,
} from "@/server/services/plan.service";
import { listRoutesByUser } from "@/server/services/route.service";
import { Container } from "@/components/ui/Container";
import { MeHeaderCard } from "@/features/me/components/MeHeaderCard";
import { ChildrenCard } from "@/features/me/components/ChildrenCard";
import { PlanCard } from "@/features/me/components/PlanCard";
import Link from "next/link";
import { MapPin, Plus, Clock } from "lucide-react";
import { BUDGET_LABELS } from "@/mocks/routes.mock";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function MePage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Role-based redirect
  switch (user.role) {
    case "BUSINESS_OWNER":
      redirect("/business/verification");
    case "ADMIN":
    case "MODERATOR":
      redirect("/admin");
    case "USER":
      // Continue to render profile page
      break;
  }

  // Fetch children with interests using separate queries to avoid TypeScript issues
  const childrenRaw = await prisma.child.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Fetch interests separately if there are children
  const childIds = childrenRaw.map(child => child.id);
  
  let systemInterestsData: any[] = [];
  let customInterestsData: any[] = [];
  
  if (childIds.length > 0) {
    // Use raw queries to avoid TypeScript issues
    systemInterestsData = await prisma.$queryRaw`
      SELECT "childId", "interestSlug" 
      FROM "ChildInterest" 
      WHERE "childId" = ANY(${childIds})
    `;
    
    customInterestsData = await prisma.$queryRaw`
      SELECT "childId", "label" 
      FROM "ChildCustomInterest" 
      WHERE "childId" = ANY(${childIds})
    `;
  }

  // Transform the data to match expected interface
  const children = childrenRaw.map(child => ({
    id: child.id,
    name: child.name,
    birthDate: child.birthDate,
    systemInterests: systemInterestsData
      .filter((interest: any) => interest.childId === child.id)
      .map((interest: any) => ({ interestSlug: interest.interestSlug })),
    customInterests: customInterestsData
      .filter((interest: any) => interest.childId === child.id)
      .map((interest: any) => ({ label: interest.label })),
  }));

  console.log("Loaded children from database:", JSON.stringify(children, null, 2));

  // Load plan items for current week
  const weekStart = getCurrentWeekStart();
  const planItems = await listPlanItemsByWeek(user.id, weekStart);
  const planItemsByDate = groupPlanItemsByDate(planItems);

  // Load user's routes
  const userRoutes = await listRoutesByUser(user.id).catch(() => []);

  // Generate week dates for display
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date.toISOString().split("T")[0];
  });

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-4xl">
        <div className="space-y-6">
          {/* User Header */}
          <MeHeaderCard email={user.email} />

          {/* Children */}
          <ChildrenCard children={children} />

          {/* Plan */}
          <PlanCard
            weekDates={weekDates}
            planItemsByDate={planItemsByDate}
          />

          {/* My Routes */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h2 className="text-base font-semibold text-neutral-900">Мои маршруты</h2>
              <Link
                href="/routes/new"
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Создать
              </Link>
            </div>

            {userRoutes.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-neutral-400">У вас пока нет маршрутов</p>
                <Link
                  href="/routes/new"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Создать первый маршрут
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {userRoutes.map((route) => (
                  <Link
                    key={route.id}
                    href={`/routes/${route.slug}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    {/* Cover */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                      {route.coverImageUrl ? (
                        <img src={route.coverImageUrl} alt={route.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-neutral-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">{route.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {route.stops.length} точки
                        </span>
                        <span>{BUDGET_LABELS[route.budgetLevel as keyof typeof BUDGET_LABELS] ?? route.budgetLevel}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          route.status === "PUBLISHED"
                            ? "bg-green-50 text-green-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {route.status === "PUBLISHED" ? "Опубликован" : "Черновик"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
