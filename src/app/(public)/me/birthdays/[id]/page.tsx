import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { BookingStatusPage } from "@/features/me/components/BookingStatusPage";
import {
  formatPartyDateTime,
  getPartyDisplayTitle,
} from "@/features/me/lib/userBirthdayPartyUi";
import { getUserBirthdayPartyDetail } from "@/server/services/userBirthdays.service";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeBirthdayDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const party = await getUserBirthdayPartyDetail(user.id, id);
  if (!party) notFound();

  return (
    <BookingStatusPage
      party={party}
      title={getPartyDisplayTitle(party)}
      dateTimeLine={formatPartyDateTime(party)}
    />
  );
}
