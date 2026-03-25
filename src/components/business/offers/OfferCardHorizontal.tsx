"use client";

import { useState } from "react";
import Link from "next/link";
import { OfferStatusBadge } from "./OfferStatusBadge";
import { Pencil, Archive, ArchiveRestore, Trash2, Tag, MapPin, Calendar } from "lucide-react";
import { OfferStatus, OfferKind } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Offer {
  id: string;
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
}

interface OfferCardHorizontalProps {
  offer: Offer;
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
}

export function OfferCardHorizontal({
  offer,
  onDelete,
  onArchive,
  onUnarchive,
}: OfferCardHorizontalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Вы уверены, что хотите удалить это предложение?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(offer.id);
    } catch (error: any) {
      alert(error.message);
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;

    setIsArchiving(true);
    try {
      await onArchive(offer.id);
    } catch (error: any) {
      alert(error.message);
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!onUnarchive) return;

    setIsArchiving(true);
    try {
      await onUnarchive(offer.id);
    } catch (error: any) {
      alert(error.message);
      setIsArchiving(false);
    }
  };

  const kindLabel = offer.kind === "EVENT" ? "Мероприятие" : "Услуга";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Cover Image */}
        {offer.coverImage ? (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
            <img
              src={offer.coverImage}
              alt={offer.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
            <Tag className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {offer.title}
                </h3>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {kindLabel}
                </span>
              </div>
              {offer.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {offer.description}
                </p>
              )}
            </div>
            <OfferStatusBadge status={offer.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{offer.place.title}</span>
            </div>
            {offer.dateFrom && offer.dateTo && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(offer.dateFrom), "d MMM", { locale: ru })} - {format(new Date(offer.dateTo), "d MMM", { locale: ru })}
                </span>
              </div>
            )}
            {offer.priceText && (
              <span>{offer.priceText}</span>
            )}
            {offer.priceFrom !== null && !offer.priceText && (
              <span>от {offer.priceFrom} BYN</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href={`/editor/offer/${offer.id}/edit`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>

            {onArchive && (
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                title="В архив"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}

            {onUnarchive && (
              <button
                onClick={handleUnarchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                title="Восстановить"
              >
                <ArchiveRestore className="w-4 h-4" />
              </button>
            )}

            {offer.status === "DRAFT" && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
