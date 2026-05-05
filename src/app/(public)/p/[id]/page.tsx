import type { Metadata } from "next";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  void id;
  return { title: "План праздника" };
}

export default async function PublicBirthdayPlanPage({ params }: PageProps) {
  const { id } = await params;
  void id;
  notFound();
}
