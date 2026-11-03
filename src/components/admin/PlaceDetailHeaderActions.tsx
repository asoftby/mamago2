import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlaceDetailBackLink } from "@/lib/admin/placeDetailNavigation";
import { getPlacePreviewPath } from "@/lib/content-preview/paths";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";

type PlaceDetailHeaderActionsProps = {
  place: {
    id: string;
    slug: string | null;
    status: string;
    archivedAt: Date | null;
  };
  returnTo?: string | null;
};

/** Navigation is always visible regardless of the place's moderation status. */
export function PlaceDetailHeaderActions({
  place,
  returnTo,
}: PlaceDetailHeaderActionsProps) {
  const back = getPlaceDetailBackLink(returnTo);
  const publicUrl = place.archivedAt ? null : getPlacePublicUrl(place);
  const viewHref = publicUrl ?? getPlacePreviewPath(place.id);

  return (
    <div className="border-b border-gray-200 bg-white">
      <nav
        aria-label="Навигация по месту"
        className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3"
      >
        <Button variant="ghost" size="sm" asChild>
          <Link href={back.href}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {back.label}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(`/admin/content/places/${place.id}`)}`}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Редактировать
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={viewHref} target="_blank" rel="noopener noreferrer">
              {publicUrl ? (
                <ExternalLink className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {publicUrl ? "Открыть на сайте" : "Предпросмотр"}
            </a>
          </Button>
        </div>
      </nav>
    </div>
  );
}
