import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  void id;
  return applyGlobalRobotsOverride({ title: "План праздника" });
}

export default async function PublicBirthdayPlanPage({ params }: PageProps) {
  const { id } = await params;
  void id;
  notFound();
}
