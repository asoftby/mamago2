import type { Metadata } from "next";
import { getSafeTelegramReturnPath } from "@/lib/telegram/webAppButton";
import { BusinessTelegramOpenClient } from "./BusinessTelegramOpenClient";

export const metadata: Metadata = {
  title: "Открываем записи и заказы — mamaGo",
  robots: { index: false, follow: false },
};

export default async function BusinessTelegramOpenPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const safe = getSafeTelegramReturnPath(typeof params.next === "string" ? params.next : null);
  const path = new URL(safe, "https://mamago.invalid");
  // This authenticated launcher is only for the Booking inbox, not an
  // arbitrary redirect or URL-supplied impersonation of a business.
  const destination = path.pathname === "/business/bookings" ? safe : "/business/bookings";
  return <BusinessTelegramOpenClient destination={destination} />;
}
