import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { adminPath } from "@/lib/routing/surface";
import { CrmDashboard } from "@/features/work/components/CrmDashboard";

export const dynamic = "force-dynamic";

export default async function AdminWorkPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect(adminPath(""));
  }

  // SupportThread remains the canonical support source. No duplicate CRM tickets.
  let openSupportCount: number | null = null;
  try {
    openSupportCount = await prisma.supportThread.count({
      where: { status: { in: ["NEW", "IN_PROGRESS"] } },
    });
  } catch (error) {
    console.error("[admin/work] support count unavailable:", error instanceof Error ? error.name : "unknown");
  }

  return <CrmDashboard actorId={user.id} openSupportCount={openSupportCount} />;
}
