import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getParentBookings } from "@/server/services/booking/parentBookings.service";
import { Container } from "@/components/ui/Container";
import { ParentBookingsClient } from "./ParentBookingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мои записи — mamaGo",
};

export default async function ParentBookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bookings = await getParentBookings(user.id);

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8">
      <Container className="max-w-2xl">
        <ParentBookingsClient bookings={bookings} />
      </Container>
    </div>
  );
}
