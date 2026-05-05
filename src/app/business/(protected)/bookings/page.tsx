import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BookingsPageClient } from "./BookingsPageClient";

export default async function BusinessBookingsPage() {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Записи и заказы"
        description="Заявки от клиентов по вашим событиям, местам и предложениям"
      />
      <BookingsPageClient />
    </div>
  );
}
