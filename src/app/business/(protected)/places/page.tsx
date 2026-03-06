import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PlacesList } from "./PlacesList";

export default async function PlacesPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  // Fetch places owned by this user
  const places = await prisma.place.findMany({
    where: {
      ownerUserId: user.id,
    },
    select: {
      id: true,
      title: true,
      status: true,
      formattedAddr: true,
      customAddress: true,
      city: {
        select: {
          hasMetro: true,
          metroMaxDistanceM: true,
        },
      },
      districtAuto: {
        select: {
          name: true,
        },
      },
      districtManual: {
        select: {
          name: true,
        },
      },
      metroAuto: {
        select: {
          name: true,
        },
      },
      metroAutoDistanceM: true,
      metroManual: {
        select: {
          name: true,
        },
      },
      metroManualDistanceM: true,
      images: {
        select: {
          id: true,
          url: true,
          kind: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Мои места</h1>
        <p className="text-gray-600 mt-2">
          Управляйте вашими местами и отслеживайте их статус
        </p>
      </div>

      <PlacesList places={places} />
    </div>
  );
}

