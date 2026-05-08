"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Instagram, Clock } from "lucide-react";
import { sortAgeKeys } from "@/lib/config/ages";
import { getCategoryLabel } from "@/lib/placeCategoryLabels";
import { getFormatLabel } from "@/lib/placeChips";

interface PlacePreviewCardProps {
  place: {
    title: string;
    shortDesc: string | null;
    description: string | null;
    category: string | null;
    formattedAddr: string | null;
    phone: string | null;
    website: string | null;
    instagramHandle: string | null;
    ageTags: string[];
    activityTypes: string[];
    visitFormats: string[];
    images: Array<{
      id: string;
      url: string;
      kind: string;
    }>;
    openingHours?: {
      mode: string;
      rules?: Array<{
        dayOfWeek: number | string;
        isOpen: boolean;
        intervals?: Array<{
          startTime: string;
          endTime: string;
        }>;
      }>;
    } | null;
  };
}

export function PlacePreviewCard({ place }: PlacePreviewCardProps) {
  const logoImage = place.images.find(img => img.kind === "LOGO");
  const galleryImages = place.images.filter(img => img.kind === "GALLERY").slice(0, 6);
  
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Header with logo */}
        <div className="flex items-start gap-4">
          {logoImage && (
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 bg-white">
                <img 
                  src={logoImage.url} 
                  alt="Логотип" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {place.title}
            </h2>
            {place.shortDesc && (
              <p className="text-gray-600">{place.shortDesc}</p>
            )}
          </div>
        </div>

        {/* Description */}
        {place.description && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Описание</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{place.description}</p>
          </div>
        )}

        {/* Category */}
        {place.category && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Категория</h3>
            <div className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
              {getCategoryLabel(place.category)?.toLowerCase()}
            </div>
          </div>
        )}

        {/* Activity Types */}
        {place.activityTypes && place.activityTypes.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Типы активностей</h3>
            <div className="flex flex-wrap gap-2">
              {place.activityTypes.map((type, idx) => (
                <Badge key={idx} className="bg-primary/10 text-primary hover:bg-primary/20">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Age Tags */}
        {place.ageTags && place.ageTags.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Возраст</h3>
            <div className="flex flex-wrap gap-2">
              {sortAgeKeys(place.ageTags).map((tag, idx) => (
                <Badge key={idx} className="bg-blue-50 text-blue-700">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Visit Formats */}
        {place.visitFormats && place.visitFormats.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Формат посещения</h3>
            <div className="flex flex-wrap gap-2">
              {place.visitFormats.map((format, idx) => (
                <Badge key={idx} className="bg-green-50 text-green-700">
                  {getFormatLabel(format)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {galleryImages.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Фотографии</h3>
            <div className="grid grid-cols-3 gap-2">
              {galleryImages.map((img, idx) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border">
                  <img 
                    src={img.url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                  {/* Photo number badge */}
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
                    Фото №{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {place.formattedAddr && (
          <div className="flex items-start gap-2 text-gray-700">
            <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{place.formattedAddr}</span>
          </div>
        )}

        {/* Opening Hours */}
        {place.openingHours && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Режим работы</h3>
            </div>
            {place.openingHours.mode === "ALWAYS_OPEN" && (
              <div className="text-green-600">Открыто круглосуточно</div>
            )}
            {place.openingHours.mode === "BY_APPOINTMENT" && (
              <div className="text-blue-600">По записи</div>
            )}
            {place.openingHours.mode === "TEMPORARILY_CLOSED" && (
              <div className="text-red-600">Временно закрыто</div>
            )}
            {place.openingHours.mode === "WEEKLY" && place.openingHours.rules && (() => {
              const openRules = place.openingHours.rules.filter(
                rule => rule.isOpen && rule.intervals && rule.intervals.length > 0
              );
              
              if (openRules.length === 0) {
                return <div className="text-gray-500">Расписание не настроено</div>;
              }
              
              const dayNamesMap: Record<string | number, string> = {
                0: "пн", 1: "вт", 2: "ср", 3: "чт", 4: "пт", 5: "сб", 6: "вс",
                "MON": "пн", "TUE": "вт", "WED": "ср", "THU": "чт", 
                "FRI": "пт", "SAT": "сб", "SUN": "вс"
              };
              
              return (
                <div className="space-y-1 text-sm">
                  {openRules.map((rule, idx) => {
                    const dayName = dayNamesMap[rule.dayOfWeek] || `день ${rule.dayOfWeek}`;
                    const times = rule.intervals!
                      .map(int => `${int.startTime}-${int.endTime}`)
                      .join(", ");
                    return (
                      <div key={idx}>
                        <span className="font-medium">{dayName}:</span> {times}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Contacts */}
        {(place.phone || place.website || place.instagramHandle) && (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Контакты</h3>
            {place.phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4" />
                <a href={`tel:${place.phone}`} className="hover:text-primary">
                  {place.phone}
                </a>
              </div>
            )}
            {place.website && (
              <div className="flex items-center gap-2 text-gray-700">
                <Globe className="w-4 h-4" />
                <a 
                  href={place.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary truncate"
                >
                  {place.website}
                </a>
              </div>
            )}
            {place.instagramHandle && (
              <div className="flex items-center gap-2 text-gray-700">
                <Instagram className="w-4 h-4" />
                <a 
                  href={`https://instagram.com/${place.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  @{place.instagramHandle}
                </a>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
