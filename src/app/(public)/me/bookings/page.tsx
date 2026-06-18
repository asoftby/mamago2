import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getParentBookings } from "@/server/services/booking/parentBookings.service";
import { ParentBookingsClient } from "./ParentBookingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мои записи — mamaGo",
};

export default async function ParentBookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bookings = await getParentBookings(user.id);

  return <ParentBookingsClient bookings={bookings} />;
}
