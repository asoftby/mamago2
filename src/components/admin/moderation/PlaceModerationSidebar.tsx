"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Mail, Building2, MapPin, Hash } from "lucide-react";
import { getPlaceCompletion } from "@/components/business/wizard/place/completion";
import type { PlaceFormData } from "@/components/business/wizard/place/types";

interface PlaceModerationSidebarProps {
  place: {
    id: string;
    title: string;
    status: string;
    slug: string | null;
    formattedAddr: string | null;
    owner: {
      id: string;
      email: string;
      business: {
        name: string;
      } | null;
    };
    city: {
      id: number;
      name: string;
    } | null;
  };
  placeFormData?: PlaceFormData;
  publicUrl: string | null;
  onCreateRequest?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "bg-gray-100 text-gray-800" },
  PENDING: { label: "На модерации", color: "bg-yellow-100 text-yellow-800" },
  PUBLISHED: { label: "Опубликовано", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Отклонено", color: "bg-red-100 text-red-800" },
  NEEDS_REVISION: { label: "Требует доработки", color: "bg-orange-100 text-orange-800" },
};

export function PlaceModerationSidebar({
  place,
  placeFormData,
  publicUrl,
  onCreateRequest,
}: PlaceModerationSidebarProps) {
  const statusInfo = STATUS_LABELS[place.status] || {
    label: place.status,
    color: "bg-gray-100 text-gray-800",
  };

  const completion = placeFormData ? getPlaceCompletion(placeFormData) : null;

  return (
    <div className="space-y-4 sticky top-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Статус</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge className={statusInfo.color}>
            {statusInfo.label}
          </Badge>
        </CardContent>
      </Card>

      {/* Completion Card */}
      {completion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Полнота заполнения</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">
                  {completion.percent}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    completion.percent === 100 ? "bg-green-600" :
                    completion.percent >= 80 ? "bg-blue-600" :
                    completion.percent >= 50 ? "bg-amber-500" : "bg-gray-400"
                  }`}
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              {completion.percent < 100 && completion.missingFields.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Не заполнено:
                  </div>
                  <ul className="space-y-1">
                    {completion.missingFields.slice(0, 3).map((field) => (
                      <li key={field.field} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        {field.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Hash className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-gray-500">ID</div>
              <div className="font-mono text-xs">{place.id}</div>
            </div>
          </div>

          {place.owner.business && (
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-gray-500">Бизнес</div>
                <div className="font-medium">{place.owner.business.name}</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-gray-500">Владелец</div>
              <div className="font-medium break-all">{place.owner.email}</div>
            </div>
          </div>

          {place.city && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-gray-500">Город</div>
                <div className="font-medium">{place.city.name}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Действия</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {publicUrl ? (
            <Button
              variant="default"
              className="w-full justify-start"
              asChild
            >
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Открыть на сайте
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Не опубликовано
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full justify-start"
            asChild
          >
            <a
              href={`mailto:${place.owner.email}?subject=Regarding ${place.title}`}
            >
              <Mail className="w-4 h-4 mr-2" />
              Написать владельцу
            </a>
          </Button>

          {onCreateRequest && place.status === "PUBLISHED" && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onCreateRequest}
            >
              Создать запрос на доработку
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
