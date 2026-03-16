import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OfferWizard } from "@/components/business/wizard/offer/OfferWizard";

export default async function NewOfferPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  // Verify user has a business
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  if (!business) {
    console.warn(`User ${user.email} has BUSINESS_OWNER role but no Business entity`);
    redirect("/business/onboarding");
  }

  return (
    <OfferWizard
      mode="create"
      userId={user.id}
      userRole="BUSINESS_OWNER"
      business={business}
    />
  );
}