import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { EventWizard } from "@/components/business/wizard/event/EventWizard";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Новое событие | MamaGo Business",
  description: "Создание нового события",
};

export default async function NewEventPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  // Get user's business profile
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      legalName: true,
      phone: true,
    },
  });

  console.log("NewEventPage - user:", user.id, "role:", user.role, "business:", business);

  return (
    <EventWizard
      mode="create"
      userId={user.id}
      userRole={user.role}
      business={business ? {
        id: business.id,
        name: business.name,
        description: business.legalName || undefined,
        phone: business.phone || undefined,
      } : {
        // Fallback mock business for development
        id: "mock-business-1",
        name: "Мой бизнес",
        description: "Описание бизнеса",
        phone: "+375 29 123 45 67",
      }}
    />
  );
}
