import { getCurrentUser } from "@/lib/auth/server";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { OfferWizard } from "@/components/business/wizard/offer/OfferWizard";

interface EditOfferPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditOfferPage({ params }: EditOfferPageProps) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  const { id } = await params;

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

  // Fetch the offer and verify ownership
  const offer = await prisma.offer.findFirst({
    where: {
      id,
      // TODO: Add proper ownership verification based on offer structure
    },
    // TODO: Add proper includes based on offer structure
  });

  if (!offer) {
    notFound();
  }

  return (
    <OfferWizard
      mode="edit"
      offer={offer}
      userId={user.id}
      userRole="BUSINESS_OWNER"
      business={business}
    />
  );
}