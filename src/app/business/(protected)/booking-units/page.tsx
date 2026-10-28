import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BookingUnitManager } from "@/components/business/booking-units/BookingUnitManager";

export const metadata = { title: "Ресурсы и расписание | Кабинет партнёра" };

export default async function BusinessBookingUnitsPage() {
  // The protected business layout also enforces approved/active status.
  const user = await getCurrentUser();
  if (!user) redirect("/business");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business");
  const offers = await prisma.offer.findMany({
    where: {
      place: { ownerBusinessId: business.id },
      productType: { in: ["PARTY_SERVICE", "PARTY_PACKAGE"] },
      archivedAt: null,
    },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });
  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="ДЕТСКИЕ ПРАЗДНИКИ"
        title="Ресурсы и расписание"
        description="Настройте помещения и исполнителей, их рабочее время и закрытые даты. В конструкторе праздников можно подтвердить только доступный ресурс."
      />
      <BookingUnitManager offers={offers} />
    </div>
  );
}
