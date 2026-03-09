import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { getPlaceDisplayTitle } from "@/lib/placeDisplayTitle";
import { findPlaceBySlug } from "@/lib/slug/placeSlugService";
import { PlaceGalleryPreview } from "@/components/place/PlaceGalleryPreview";
import { getPlaceLocationString } from "@/lib/placeLocationString";

interface PlacePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  
  // Check if it's a legacy ID (cuid format)
  const isLegacyId = slug.length > 20 && !slug.includes("-");
  
  let place;
  
  if (isLegacyId) {
    // Legacy ID - find by id
    place = await prisma.place.findUnique({
      where: { id: slug },
      select: { 
        slug: true, 
        title: true, 
        shortDesc: true,
        shortAddress: true,
        cityId: true,
        id: true,
      },
    });
    
    // If found and has slug, this will be redirected in the page component
    if (!place) {
      return {
        title: "Place Not Found",
      };
    }
  } else {
    // Modern slug - find by slug
    place = await prisma.place.findUnique({
      where: { slug },
      select: { 
        title: true, 
        shortDesc: true,
        formattedAddr: true,
        customAddress: true,
        shortAddress: true,
        cityId: true,
        id: true,
      },
    });
    
    if (!place) {
      return {
        title: "Place Not Found",
      };
    }
  }

  // Get display title with duplicate check
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: place.shortAddress,
    cityId: place.cityId,
  });

  return {
    title: displayTitle,
    description: place.shortDesc,
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;
  
  // Check if it's a legacy ID (cuid format - long string without hyphens in middle)
  const isLegacyId = slug.length > 20 && !slug.includes("-");
  
  let placeId: string;
  let shouldRedirect = false;
  let redirectSlug: string | null = null;
  
  if (isLegacyId) {
    // Legacy ID - find by id and redirect to slug URL
    const place = await prisma.place.findUnique({
      where: { id: slug },
      select: { id: true, slug: true },
    });
    
    if (!place) {
      notFound();
    }
    
    if (place.slug) {
      // Redirect to new slug-based URL
      redirect(`/places/${place.slug}`);
    } else {
      // Place exists but has no slug (shouldn't happen after backfill)
      notFound();
    }
  }
  
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
      select: { slug: true },
    });
    
    if (currentPlace?.slug) {
      // Permanent redirect to current slug
      redirect(`/places/${currentPlace.slug}`);
    } else {
      // Place exists but has no current slug
      notFound();
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

  // Get display title with duplicate check
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: place.shortAddress,
    cityId: place.cityId,
  });

  // Get formatted location string
  const locationString = getPlaceLocationString(place);

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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {displayTitle}
              </h1>
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
        <div className="bg-white rounded-lg shadow-sm p-6">
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
      </div>
    </div>
  );
}
