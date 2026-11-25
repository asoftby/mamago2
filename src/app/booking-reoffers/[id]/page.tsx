import { BookingReofferClient } from "./BookingReofferClient";

export const metadata = {
  title: "Предложение места — mamaGo",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingReofferClient key={id} id={id} />;
}
