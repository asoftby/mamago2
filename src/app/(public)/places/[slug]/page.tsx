import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { getPlaceDisplayTitle } from "@/lib/placeDisplayTitle";
import { findPlaceBySlug } from "@/lib/slug/placeSlugService";
import { PlaceGalleryPreview } from "@/components/place/PlaceGalleryPreview";
import { getPlaceLocationString } from "@/lib/placeLocationString";
import { PlaceCard } from "@/components/place/PlaceCard";
import { buildPlaceChips } from "@/lib/placeChips";
import { getCurrentUser } from "@/lib/auth/server";
import { canShowEditButton } from "@/lib/permissions/placeEditPermissions";
import { PlaceEditStepSelector } from "@/components/place/PlaceEditStepSelector";
import { isPlacePubliclyVisible } from "@/lib/plan/publicVisibility";
import { placeOwnerBusinessActiveWhere } from "@/server/public/publicContentVisibility";

interface PlacePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  
  // Check if it's a legacy ID (cuid format)
  const isLegacyId = slug.length > 20 && !slug.includes("-");
  
  let place: {
    id: string;
    title: string;
    shortDesc: string;
    formattedAddr: string | null;
    customAddress: string | null;
    cityId: string | null;
    status: string;
    archivedAt: Date | null;
    owner: { business: { operationalStatus: string } | null } | null;
  } | null;
  
  if (isLegacyId) {
    // Legacy ID - find by id
    place = await prisma.place.findUnique({
      where: { id: slug },
      select: { 
        id: true,
        title: true, 
        shortDesc: true,
        formattedAddr: true,
        customAddress: true,
        cityId: true,
        status: true,
        archivedAt: true,
        owner: {
          select: {
            business: { select: { operationalStatus: true } },
          },
        },
      },
    });
    
    // If found and has slug, this will be redirected in the page component
    if (!place) {
      return {
        title: "Place Not Found",
      };
    }
  } else {
    const slugResult = await findPlaceBySlug(slug);
    if (!slugResult) {
      return {
        title: "Place Not Found",
      };
    }
    place = await prisma.place.findUnique({
      where: { id: slugResult.placeId },
      select: { 
        id: true,
        title: true, 
        shortDesc: true,
        formattedAddr: true,
        customAddress: true,
        cityId: true,
        status: true,
        archivedAt: true,
        owner: {
          select: {
            business: { select: { operationalStatus: true } },
          },
        },
      },
    });
    
    if (!place) {
      return {
        title: "Place Not Found",
      };
    }
  }

  if (!isPlacePubliclyVisible(place)) {
    return { title: "Place Not Found" };
  }

  // Get display title with duplicate check
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: null,
    cityId: place.cityId,
  });

  return {
    title: displayTitle,
    description: place.shortDesc,
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;
  
  // Get current user for edit permissions
  const currentUser = await getCurrentUser();
  
  // Check if it's a legacy ID (cuid format - long string without hyphens in middle)
  const isLegacyId = slug.length > 20 && !slug.includes("-");
  
  let placeId: string;
  
  if (isLegacyId) {
    // Legacy ID - find by id and redirect to slug URL
    const place = await prisma.place.findUnique({
      where: { id: slug },
      select: { id: true },
    });
    
    if (!place) {
      notFound();
    }
    
    // For now, just use the ID as the place identifier
    placeId = place.id;
  } else {
    // Modern slug - find by current slug or historical slug
    const slugResult = await findPlaceBySlug(slug);
    
    if (!slugResult) {
      notFound();
    }
    
    placeId = slugResult.placeId;
    
    // If found in history, we need to redirect to current slug
    if (slugResult.isRedirect) {
      const currentPlace = await prisma.place.findUnique({
        where: { id: placeId },
        select: { id: true },
      });
      
      if (!currentPlace) {
        // Place exists but has no current slug
        notFound();
      }
    }
  }
  
  // Fetch full place data
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      city: {
        select: {
          name: true,
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
          business: {
            select: {
              name: true,
              operationalStatus: true,
            },
          },
        },
      },
    },
  });

  if (!place) {
    notFound();
  }

  // Only show published places
  if (place.status !== "PUBLISHED") {
    notFound();
  }

  if (!isPlacePubliclyVisible(place)) {
    notFound();
  }

  // Check edit permissions
  const canEdit = canShowEditButton(currentUser, {
    placeId: place.id,
    ownerUserId: place.ownerUserId,
    status: place.status,
  });

  // Get display title with duplicate check
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: null,
    cityId: place.cityId,
  });

  // Get formatted location string
  const locationString = getPlaceLocationString(place);

  // Fetch related places from the same network/group
  const relatedPlaces = place.placeGroupId
    ? await prisma.place.findMany({
        where: {
          AND: [
            {
              placeGroupId: place.placeGroupId,
              id: { not: place.id }, // Exclude current place
              status: "PUBLISHED", // Only published places
              archivedAt: null,
            },
            placeOwnerBusinessActiveWhere,
          ],
        },
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          customAddress: true,
          cityId: true,
          category: true,
          ageTags: true,
          visitFormats: true,
          activityTypes: true,
          images: {
            where: { kind: "GALLERY" },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
          city: {
            select: { name: true },
          },
          districtManual: {
            select: { name: true },
          },
          districtAuto: {
            select: { name: true },
          },
          metroManual: {
            select: { name: true },
          },
          metroAuto: {
            select: { name: true },
          },
        },
        orderBy: [
          // Same city first
          { cityId: place.cityId ? "asc" : "desc" },
          // Then by title
          { title: "asc" },
        ],
        take: 6,
      })
    : [];

  const logoImage = place.images.find((img) => img.kind === "LOGO");
  const galleryImages = place.images
    .filter((img) => img.kind === "GALLERY")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start gap-6">
            {logoImage && (
              <div className="flex-shrink-0">
                <img
                  src={logoImage.url}
                  alt={place.title}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {displayTitle}
                </h1>
                {canEdit && (
                  <PlaceEditStepSelector placeId={place.id} />
                )}
              </div>
              <p className="text-lg text-gray-600 mb-4">{place.shortDesc}</p>
              {locationString && (
                <p className="text-sm text-gray-500">
                  📍 {locationString}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {place.description && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              О месте
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {place.description}
            </p>
          </div>
        )}

        {/* Gallery with new preview component */}
        <PlaceGalleryPreview images={galleryImages} />

        {/* Contact Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Контакты
          </h2>
          <div className="space-y-2">
            {place.phone && (
              <p className="text-gray-700">
                📞 <a href={`tel:${place.phone}`} className="hover:text-blue-600">{place.phone}</a>
              </p>
            )}
            {place.website && (
              <p className="text-gray-700">
                🌐 <a href={place.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">{place.website}</a>
              </p>
            )}
            {place.instagramHandle && (
              <p className="text-gray-700">
                📷 <a href={place.instagramUrl || `https://instagram.com/${place.instagramHandle}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">@{place.instagramHandle}</a>
              </p>
            )}
          </div>
        </div>

        {/* Related Places from Same Network */}
        {relatedPlaces.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Еще места этой сети
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(await Promise.all(relatedPlaces.map(async (relatedPlace) => {
                // Use first gallery image as cover (priority over logo)
                const coverImage = relatedPlace.images[0];
                
                // Get display title with duplicate check
                const displayTitle = await getPlaceDisplayTitle(prisma, {
                  id: relatedPlace.id,
                  title: relatedPlace.title,
                  formattedAddr: relatedPlace.formattedAddr,
                  customAddress: relatedPlace.customAddress,
                  shortAddress: null,
                  cityId: relatedPlace.cityId,
                });
                
                // Build simple address: City + Street
                const cityName = relatedPlace.city?.name;
                const streetAddress = relatedPlace.formattedAddr || relatedPlace.customAddress;
                
                // Extract street and number from full address (remove city duplication)
                let cleanStreetAddress = streetAddress;
                if (streetAddress && cityName) {
                  // Remove city name from address if present
                  cleanStreetAddress = streetAddress
                    .replace(new RegExp(`,?\\s*${cityName}.*$`, 'i'), '')
                    .trim();
                }
                
                // Format line 1: "Минск, ул. Восточная, 137"
                const cityAddress = cityName && cleanStreetAddress
                  ? `${cityName}, ${cleanStreetAddress}`
                  : cityName || cleanStreetAddress || undefined;
                
                // Format line 2: metro only (prefer manual over auto)
                const metro = relatedPlace.metroManual || relatedPlace.metroAuto;
                const metroLabel = metro?.name ? `м. ${metro.name}` : undefined;
                
                // Build chips: max 3, priority: age > category > format
                const chips = buildPlaceChips(
                  relatedPlace.ageTags,
                  relatedPlace.category,
                  relatedPlace.visitFormats
                );
                
                return (
                  <PlaceCard
                    key={relatedPlace.id}
                    id={relatedPlace.id}
                    slug={relatedPlace.id}
                    title={displayTitle}
                    coverImage={coverImage?.url}
                    cityAddress={cityAddress}
                    metro={metroLabel}
                    tags={chips}
                    variant="network"
                  />
                );
              })))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
