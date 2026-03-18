import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { listAllPlanItems } from "@/server/services/plan.service";
import { prisma } from "@/lib/prisma";
import { PlanPageClient } from "./PlanPageClient";

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load all plan items
  const planItems = await listAllPlanItems(user.id);

  // Load saved ideas (for recommendations block A)
  const ideas = await prisma.idea.findMany({
    where: { userId: user.id },
    select: { activityId: true },
    take: 10,
  });
  const ideaActivityIds = ideas.map((i) => i.activityId);

  // Load children for family recommendations
  const children = await prisma.child.findMany({
    where: { parentId: user.id },
    select: { birthDate: true },
  });

  // Compute children ages
  const today = new Date();
  const childrenAges = children.map((c) => {
    const birth = new Date(c.birthDate);
    return today.getFullYear() - birth.getFullYear();
  });

  // Serialize plan items (dates need to be strings for client)
  const serializedItems = planItems.map((item) => ({
    id: item.id,
    date: item.date,
    startsAt: item.startsAt ? item.startsAt.toISOString() : null,
    activityId: item.activityId,
    title: item.title,
    coverImageUrl: item.coverImageUrl,
    activity: item.activity
      ? {
          id: item.activity.id,
          title: item.activity.title,
          type: item.activity.type,
          coverImageUrl: item.activity.coverImageUrl,
          ageLabel: item.activity.ageLabel,
        }
      : null,
  }));

  return (
    <PlanPageClient
      initialItems={serializedItems}
      ideaActivityIds={ideaActivityIds}
      childrenAges={childrenAges}
    />
  );
}
