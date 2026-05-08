"use client";

import { MapPin, ExternalLink, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PlaceAddressSectionProps {
  address?: string;
  district?: string;
  metro?: string;
  latitude?: number;
  longitude?: number;
  mapsOpenUrl?: string;
  mapsDirectionsUrl?: string;
  workingHoursSummary?: string;
}

export function PlaceAddressSection({
  address,
  district,
  metro,
  latitude,
  longitude,
  mapsOpenUrl,
  mapsDirectionsUrl,
  workingHoursSummary,
}: PlaceAddressSectionProps) {
  // Build Google Maps embed URL
  const mapEmbedUrl =
    latitude && longitude
      ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}&q=${latitude},${longitude}&zoom=15`
      : undefined;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Адрес</h2>

      {/* Google Map */}
      {mapEmbedUrl ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <iframe
            src={mapEmbedUrl}
            width="100%"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Карта местоположения"
          />
        </div>
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
          <div className="text-center text-gray-500">
            <MapPin className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm">Карта недоступна</p>
          </div>
        </div>
      )}

      {/* Address Details */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        {address && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#EF8759]" />
            <div className="flex-1">
              <div className="text-base font-medium text-gray-900">{address}</div>
            </div>
          </div>
        )}

        {(district || metro) && (
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            {district && (
              <span className="rounded-full bg-white px-3 py-1">
                {district}
              </span>
            )}
            {metro && (
              <span className="rounded-full bg-white px-3 py-1">
                м. {metro}
              </span>
            )}
          </div>
        )}

        {workingHoursSummary && (
          <div className="border-t border-gray-200 pt-3 text-sm text-gray-600">
            {workingHoursSummary}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {mapsOpenUrl && (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="flex-1 gap-2"
          >
            <Link href={mapsOpenUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Показать на Google Картах
            </Link>
          </Button>
        )}
        {mapsDirectionsUrl && (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="flex-1 gap-2"
          >
            <Link href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" />
              Построить маршрут
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
