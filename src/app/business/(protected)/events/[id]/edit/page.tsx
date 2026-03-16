import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { EventWizard } from "@/components/business/wizard/event/EventWizard";
import { prisma } from "@/lib/prisma";
// import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Редактирование события | MamaGo Business",
  description: "Редактирование события",
};

interface EditEventPageProps {
  params: {
    id: string;
  };
}

export default async function EditEventPage({ params }: EditEventPageProps) {
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

  // TODO: Fetch event from database
  // const event = await prisma.event.findUnique({
  //   where: { id: params.id },
  //   include: { ... }
  // });

  // if (!event) {
  //   notFound();
  // }

  // TODO: Check ownership/permissions

  return (
    <EventWizard
      mode="edit"
      // event={event}
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
