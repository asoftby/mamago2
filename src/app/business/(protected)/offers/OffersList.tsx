"use client";

import { BusinessContentList, ItemHandlers } from "@/components/business/shared/BusinessContentList";
import { OfferCardHorizontal } from "@/components/business/offers/OfferCardHorizontal";
import { Tag } from "lucide-react";
import { OfferStatus, OfferKind } from "@prisma/client";

interface Offer {
  id: string;
  placeId: string;
  kind: OfferKind;
  title: string;
  description: string | null;
  coverImage: string | null;
  priceFrom: number | null;
  priceText: string | null;
  status: OfferStatus;
  dateFrom: Date | null;
  dateTo: Date | null;
  place: {
    id: string;
    title: string;
  };
  createdAt: Date;
}

interface OffersListProps {
  offers: Offer[];
  currentView: "active" | "archived";
}

export function OffersList({ offers, currentView }: OffersListProps) {
  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/business/offers/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete");
    }
  };

  // Archive/unarchive will be implemented when we add archived field to Offer
  const handleArchive = async (id: string) => {
    // TODO: Implement when Offer model has archived field
    console.log("Archive not yet implemented for offers");
  };

  const handleUnarchive = async (id: string) => {
    // TODO: Implement when Offer model has archived field
    console.log("Unarchive not yet implemented for offers");
  };

  return (
    <BusinessContentList
      items={offers}
      currentView={currentView}
      emptyIcon={<Tag className="w-8 h-8 text-gray-400" />}
      emptyTitle="У вас пока нет предложений"
      emptyDescription="Создайте первое предложение, чтобы привлечь больше клиентов"
      addButtonText="Добавить предложение"
      addButtonHref="/business/offers/new"
      renderItem={(offer, handlers) => (
        <OfferCardHorizontal
          key={offer.id}
          offer={offer}
          onDelete={handlers.onDelete}
          onArchive={handlers.onArchive}
          onUnarchive={handlers.onUnarchive}
        />
      )}
      onDelete={handleDelete}
      onArchive={currentView === "active" ? handleArchive : undefined}
      onUnarchive={currentView === "archived" ? handleUnarchive : undefined}
    />
  );
}
