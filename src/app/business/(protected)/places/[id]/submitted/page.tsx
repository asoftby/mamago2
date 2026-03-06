import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

export default async function PlaceSubmittedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/login");
  }

  const { id } = await params;

  const place = await prisma.place.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      ownerUserId: true,
    },
  });

  if (!place) {
    notFound();
  }

  if (place.ownerUserId !== user.id) {
    redirect("/business/places");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          {place.status === "PENDING" ? (
            <Clock className="h-16 w-16 text-amber-500 mx-auto" />
          ) : (
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          )}
        </div>

        <h1 className="text-2xl font-bold mb-2">
          {place.status === "PENDING"
            ? "Место отправлено на проверку"
            : "Место создано"}
        </h1>

        <p className="text-muted-foreground mb-6">
          {place.status === "PENDING"
            ? "Мы проверим информацию и свяжемся с вами в течение 24 часов"
            : "Ваше место успешно создано"}
        </p>

        <div className="space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link href="/business/places">Мои места</Link>
          </Button>

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/business/dashboard">На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
