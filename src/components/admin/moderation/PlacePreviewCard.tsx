"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Instagram, Clock, ExternalLink, MessageSquare, Star } from "lucide-react";
import { sortAgeKeys } from "@/lib/config/ages";
import { getCategoryLabel } from "@/lib/placeCategoryLabels";
import { getFormatLabel } from "@/lib/placeChips";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { isGoogleReviewsEnabled } from "@/lib/place/googleReviewsMeta";
import Link from "next/link";

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
    googlePlaceId?: string | null;
    googleRating?: number | null;
    googleUserRatingsTotal?: number | null;
    googleReviewsJson?: unknown;
    reviews?: Array<{
      id: string;
      source: "MAMAGO" | "GOOGLE";
      status: "PUBLISHED" | "PENDING" | "HIDDEN";
      authorName: string;
      rating: number;
      text: string | null;
      createdAt: Date | string;
      ownerReplyText?: string | null;
    }>;
    _count?: {
      reviews: number;
    };
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
  const reviews = place.reviews ?? [];
  const totalReviews = place._count?.reviews ?? reviews.length;
  const googleReviewsEnabled = isGoogleReviewsEnabled(place.googlePlaceId, place.googleReviewsJson);
  
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
            <RichContentRenderer
              html={place.description}
              className="prose-gray max-w-none text-base leading-relaxed text-gray-700 prose-p:text-base prose-p:leading-relaxed prose-p:text-gray-700 prose-p:my-5 [&>p:last-child]:mb-0 prose-headings:text-gray-900 prose-strong:text-gray-900 [&>p:first-child]:mt-0"
            />
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

        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Отзывы</h3>
            </div>
            <Link
              href="/admin/moderation/reviews"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              Review Center
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          {googleReviewsEnabled && (place.googleRating || place.googleUserRatingsTotal) ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="text-sm font-medium text-blue-900">Google рейтинг</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-blue-800">
                {place.googleRating ? (
                  <>
                    <span className="font-semibold">{place.googleRating.toFixed(1)}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </>
                ) : null}
                <span>
                  {place.googleUserRatingsTotal
                    ? `${place.googleUserRatingsTotal.toLocaleString("ru-RU")} оценок`
                    : "Оценки из Google доступны"}
                </span>
              </div>
            </div>
          ) : null}

          {reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
              Отзывов пока нет
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                {totalReviews > reviews.length
                  ? `Показаны последние ${reviews.length} из ${totalReviews} отзывов`
                  : `${totalReviews} отзывов`}
              </div>

              {reviews.map((review) => (
                <div key={review.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">{review.authorName}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString("ru-RU")} · {review.source}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= review.rating ? "fill-current" : "fill-gray-200 text-gray-200"}`}
                        />
                      ))}
                    </div>
                  </div>

                  {review.text ? (
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                      {review.text}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">Текст отзыва не указан</p>
                  )}

                  {review.ownerReplyText ? (
                    <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
                      <div className="mb-1 font-medium">Ответ владельца</div>
                      <p className="whitespace-pre-line">{review.ownerReplyText}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
