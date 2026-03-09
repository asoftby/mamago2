import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceModerationView } from "@/components/admin/PlaceModerationView";
import { PlaceRevisionModerationView } from "@/components/admin/PlaceRevisionModerationView";
import { ImprovementRequestForm } from "@/components/admin/moderation/ImprovementRequestForm";
import { ImprovementRequestList } from "@/components/admin/moderation/ImprovementRequestList";

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

      return (
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="mb-6">
            <a
              href="/admin/moderation/queue"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to queue
            </a>
          </div>

          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {place.title}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This Place is published. You can create an improvement request for the business owner.
            </p>
            
            <div className="flex gap-3">
              <a
                href={`/admin/places/${place.id}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                View Place Details
              </a>
              <a
                href={`mailto:${place.owner.email}?subject=Improvement Request for ${place.title}`}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Contact Owner
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">
                Create Improvement Request
              </h3>
              <ImprovementRequestForm placeId={place.id} />
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">
                Improvement Requests
              </h3>
              <ImprovementRequestList requests={improvementRequests as any} />
            </div>
          </div>
        </div>
      );
    }
  }

  // Show regular place moderation view (for PENDING, NEEDS_REVISION, REJECTED, DRAFT)
  return <PlaceModerationView place={place} />;
}
