import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeBirthdayDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  void id;
  notFound();
}
