import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceModerationView } from "@/components/admin/PlaceModerationView";
import { PlaceRevisionModerationView } from "@/components/admin/PlaceRevisionModerationView";
import { ImprovementRequestForm } from "@/components/admin/moderation/ImprovementRequestForm";
import { ImprovementRequestList } from "@/components/admin/moderation/ImprovementRequestList";
import { PlaceDangerZone } from "@/components/admin/moderation/PlaceDangerZone";
import { PlacePreviewCard } from "@/components/admin/moderation/PlacePreviewCard";
import { PlaceModerationSidebar } from "@/components/admin/moderation/PlaceModerationSidebar";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { PlaceFormData } from "@/components/business/wizard/place/types";
import { ContentStatus, PlaceKind } from "@prisma/client";
import Link from "next/link";

export default async function PlaceModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  const { id } = await params;
  const { mode } = await searchParams;

  // Get place with all relations
  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      openingHours: {
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
      city: {
        select: {
          id: true,
          name: true,
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
      metroManual: {
        select: {
          name: true,
        },
      },
      owner: {
        select: {
          id: true,
          email: true,
          business: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!place) {
    notFound();
  }

  // Check if we should show revision mode
  const shouldShowRevision = mode === "revision" || place.status === "PUBLISHED";

  if (shouldShowRevision) {
    // Get active revision
    const revision = await prisma.placeRevision.findFirst({
      where: {
        placeId: place.id,
        status: {
          in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
        },
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
        openingHours: {
          include: {
            rules: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            exceptions: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (revision && revision.status === "PENDING") {
      // Show revision moderation view
      return <PlaceRevisionModerationView place={place} revision={revision} />;
    }

    // If place is PUBLISHED but no pending revision, show improvement request form
    if (place.status === "PUBLISHED") {
      // Get improvement requests for this place
      const improvementRequests = await prisma.improvementRequest.findMany({
        where: {
          entityType: "PLACE",
          entityId: place.id,
        },
        include: {
          createdByModerator: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const publicUrl = getPlacePublicUrl(place);

      // Map place to form data for completion calculation
      const placeFormData: PlaceFormData = {
        id: place.id,
        ownerUserId: place.ownerUserId,
        status: place.status as ContentStatus,
        title: place.title,
        category: place.category,
        shortDesc: place.shortDesc,
        description: place.description,
        ageTags: place.ageTags || [],
        activityTypes: place.activityTypes || [],
        visitFormats: place.visitFormats || [],
        lat: place.lat,
        lng: place.lng,
        googlePlaceId: place.googlePlaceId,
        formattedAddr: place.formattedAddr,
        addressJson: place.addressJson,
        customAddress: place.customAddress,
        cityId: place.cityId,
        districtAutoId: place.districtAutoId,
        districtManualId: place.districtManualId,
        metroAutoId: place.metroAutoId,
        metroAutoDistanceM: place.metroAutoDistanceM,
        metroManualId: place.metroManualId,
        metroManualDistanceM: place.metroManualDistanceM,
        phone: place.phone,
        website: place.website,
        instagramHandle: place.instagramHandle,
        instagramUrl: place.instagramUrl,
        logoImageId: place.logoImageId,
        logoUrl: place.images.find(img => img.kind === "LOGO")?.url || null,
        images: place.images.map(img => ({
          id: img.id,
          url: img.url,
          kind: img.kind as "LOGO" | "GALLERY",
          order: img.sortOrder,
          width: img.width || 0,
          height: img.height || 0,
          blurhash: img.blurhash || null,
          sortOrder: img.sortOrder,
        })),
        openingHoursId: place.openingHoursId,
        openingHoursData: place.openingHours ? {
          mode: place.openingHours.mode as any,
          timezone: place.openingHours.timezone || "Europe/Minsk",
          rules: place.openingHours.rules?.map(rule => ({
            dayOfWeek: rule.dayOfWeek,
            isOpen: rule.isOpen,
            allDay: rule.allDay || false,
            intervals: rule.intervals?.map(int => ({
              startTime: int.startTime,
              endTime: int.endTime,
            })) || [],
          })) || [],
        } : null,
        placeKind: place.placeKind as PlaceKind,
        floor: place.floor,
        unit: place.unit,
        createdAt: place.createdAt,
        updatedAt: place.updatedAt,
      };

      const STATUS_LABELS: Record<string, { label: string; color: string }> = {
        PUBLISHED: { label: "Опубликовано", color: "bg-green-100 text-green-800" },
      };

      const statusInfo = STATUS_LABELS[place.status] || {
        label: place.status,
        color: "bg-gray-100 text-gray-800",
      };

      return (
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <Link
                  href="/admin/moderation/queue"
                  className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Назад к очереди
                </Link>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {place.title}
                    </h1>
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  {place.formattedAddr && (
                    <p className="text-gray-600">{place.formattedAddr}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {publicUrl ? (
                    <Button variant="default" asChild>
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
                    <Button variant="outline" disabled>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Не опубликовано
                    </Button>
                  )}

                  <Button variant="outline" asChild>
                    <a
                      href={`mailto:${place.owner.email}?subject=Regarding ${place.title}`}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Написать владельцу
                    </a>
                  </Button>

                  <Button variant="secondary" asChild>
                    <Link
                      href={`/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(`/admin/moderation/places/${place.id}`)}`}
                    >
                      Редактор карточки
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              {/* Left Column - Place Preview */}
              <div>
                <PlacePreviewCard place={place} />
              </div>

              {/* Right Column - Moderation Sidebar */}
              <div>
                <PlaceModerationSidebar
                  place={{
                    id: place.id,
                    title: place.title,
                    status: place.status,
                    slug: place.slug,
                    formattedAddr: place.formattedAddr,
                    owner: place.owner,
                    city: place.city ? {
                      id: parseInt(place.city.id),
                      name: place.city.name,
                    } : null,
                  }}
                  placeFormData={placeFormData}
                  publicUrl={publicUrl}
                />
              </div>
            </div>

            {/* Improvement Requests Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Запросы на доработку
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Создать запрос</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImprovementRequestForm placeId={place.id} />
                  </CardContent>
                </Card>

                {/* History */}
                <Card>
                  <CardHeader>
                    <CardTitle>История запросов</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {improvementRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>Запросов на доработку пока нет</p>
                      </div>
                    ) : (
                      <ImprovementRequestList requests={improvementRequests as any} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-8">
              <PlaceDangerZone placeId={place.id} placeTitle={place.title} />
            </div>
          </div>
        </div>
      );
    }
  }

  // Show regular place moderation view (for PENDING, NEEDS_REVISION, REJECTED, DRAFT)
  return <PlaceModerationView place={place} />;
}
