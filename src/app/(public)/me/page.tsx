import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  listPlanItemsByWeek,
  groupPlanItemsByDate,
  getCurrentWeekStart,
} from "@/server/services/plan.service";
import { Container } from "@/components/ui/Container";
import { MeHeaderCard } from "@/features/me/components/MeHeaderCard";
import { ChildrenCard } from "@/features/me/components/ChildrenCard";
import { PlanCard } from "@/features/me/components/PlanCard";

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

  // Fetch children
  const children = await prisma.child.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Load plan items for current week
  const weekStart = getCurrentWeekStart();
  const planItems = await listPlanItemsByWeek(user.id, weekStart);
  const planItemsByDate = groupPlanItemsByDate(planItems);

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
        </div>
      </Container>
    </div>
  );
}
