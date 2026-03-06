"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Globe, Instagram, ArrowLeft, ArrowRight } from "lucide-react";
import { formatDistance } from "@/lib/formatDistance";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface PlaceRevisionModerationViewProps {
  place: any;
  revision: any;
}

export function PlaceRevisionModerationView({ place, revision }: PlaceRevisionModerationViewProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleModerate = async (action: "APPROVE" | "NEEDS_REVISION" | "REJECT") => {
    if ((action === "NEEDS_REVISION" || action === "REJECT") && !comment.trim()) {
      toast.error("Пожалуйста, укажите причину");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/moderation/revisions/${revision.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Failed to moderate");
      }

      toast.success("Модерация завершена");
      router.push("/admin/moderation/queue");
      router.refresh();
    } catch (error) {
      console.error("Moderation error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка модерации");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to check if field changed
  const hasChanged = (field: string) => {
    const placeValue = (place as any)[field];
    const revisionValue = (revision as any)[field];
    
    if (placeValue === revisionValue) return false;
    if (placeValue == null && revisionValue == null) return false;
    
    return true;
  };

  // Helper to render comparison row
  const ComparisonRow = ({ label, placeValue, revisionValue, changed }: {
    label: string;
    placeValue: React.ReactNode;
    revisionValue: React.ReactNode;
    changed: boolean;
  }) => (
    <div className={`grid grid-cols-2 gap-4 p-4 rounded-lg ${changed ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">{label} (Current)</div>
        <div className="text-sm text-gray-900">{placeValue || <span className="text-gray-400">—</span>}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2">
          {label} (New)
          {changed && <ArrowRight className="w-3 h-3 text-yellow-600" />}
        </div>
        <div className="text-sm text-gray-900 font-medium">{revisionValue || <span className="text-gray-400">—</span>}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/moderation/queue"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to queue
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Place Update Moderation</h1>
          <Badge variant="default" className="bg-amber-600">UPDATE</Badge>
        </div>
        <p className="text-gray-600 mt-1">
          Review changes to published Place
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Comparison View */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <ComparisonRow
            label="Title"
            placeValue={place.title}
            revisionValue={revision.title}
            changed={hasChanged("title")}
          />

          {/* Short Description */}
          {(place.shortDesc || revision.shortDesc) && (
            <ComparisonRow
              label="Short Description"
              placeValue={place.shortDesc}
              revisionValue={revision.shortDesc}
              changed={hasChanged("shortDesc")}
            />
          )}

          {/* Description */}
          {(place.description || revision.description) && (
            <ComparisonRow
              label="Description"
              placeValue={<div className="whitespace-pre-wrap">{place.description}</div>}
              revisionValue={<div className="whitespace-pre-wrap">{revision.description}</div>}
              changed={hasChanged("description")}
            />
          )}

          {/* Address */}
          <ComparisonRow
            label="Address"
            placeValue={place.formattedAddr || place.customAddress}
            revisionValue={revision.formattedAddr || revision.customAddress}
            changed={hasChanged("formattedAddr") || hasChanged("customAddress")}
          />

          {/* Coordinates */}
          {(place.lat || revision.lat) && (
            <ComparisonRow
              label="Coordinates"
              placeValue={place.lat && place.lng ? `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}` : null}
              revisionValue={revision.lat && revision.lng ? `${revision.lat.toFixed(6)}, ${revision.lng.toFixed(6)}` : null}
              changed={hasChanged("lat") || hasChanged("lng")}
            />
          )}

          {/* Phone */}
          {(place.phone || revision.phone) && (
            <ComparisonRow
              label="Phone"
              placeValue={place.phone}
              revisionValue={revision.phone}
              changed={hasChanged("phone")}
            />
          )}

          {/* Website */}
          {(place.website || revision.website) && (
            <ComparisonRow
              label="Website"
              placeValue={place.website ? <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{place.website}</a> : null}
              revisionValue={revision.website ? <a href={revision.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{revision.website}</a> : null}
              changed={hasChanged("website")}
            />
          )}

          {/* Instagram */}
          {(place.instagramHandle || revision.instagramHandle) && (
            <ComparisonRow
              label="Instagram"
              placeValue={place.instagramHandle ? `@${place.instagramHandle}` : null}
              revisionValue={revision.instagramHandle ? `@${revision.instagramHandle}` : null}
              changed={hasChanged("instagramHandle")}
            />
          )}

          {/* Images Comparison */}
          {(place.images.length > 0 || revision.images.length > 0) && (
            <div className={`p-4 rounded-lg ${
              place.images.length !== revision.images.length ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"
            }`}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Images</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Current ({place.images.length})</div>
                  <div className="grid grid-cols-2 gap-2">
                    {place.images.map((image: any) => (
                      <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <Image src={image.url} alt="" fill className="object-cover" />
                        {image.kind === "LOGO" && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                            Logo
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2">
                    New ({revision.images.length})
                    {place.images.length !== revision.images.length && (
                      <ArrowRight className="w-3 h-3 text-yellow-600" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {revision.images.map((image: any) => (
                      <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <Image src={image.url} alt="" fill className="object-cover" />
                        {image.kind === "LOGO" && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                            Logo
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tags Comparison */}
          {(place.ageTags?.length > 0 || revision.ageTags?.length > 0 ||
            place.visitFormats?.length > 0 || revision.visitFormats?.length > 0 ||
            place.activityTypes?.length > 0 || revision.activityTypes?.length > 0) && (
            <div className="p-4 rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
              <div className="space-y-3">
                {(place.ageTags?.length > 0 || revision.ageTags?.length > 0) && (
                  <ComparisonRow
                    label="Age Tags"
                    placeValue={place.ageTags?.join(", ")}
                    revisionValue={revision.ageTags?.join(", ")}
                    changed={JSON.stringify(place.ageTags) !== JSON.stringify(revision.ageTags)}
                  />
                )}
                {(place.visitFormats?.length > 0 || revision.visitFormats?.length > 0) && (
                  <ComparisonRow
                    label="Visit Formats"
                    placeValue={place.visitFormats?.join(", ")}
                    revisionValue={revision.visitFormats?.join(", ")}
                    changed={JSON.stringify(place.visitFormats) !== JSON.stringify(revision.visitFormats)}
                  />
                )}
                {(place.activityTypes?.length > 0 || revision.activityTypes?.length > 0) && (
                  <ComparisonRow
                    label="Activity Types"
                    placeValue={place.activityTypes?.join(", ")}
                    revisionValue={revision.activityTypes?.join(", ")}
                    changed={JSON.stringify(place.activityTypes) !== JSON.stringify(revision.activityTypes)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Moderation Panel (Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Moderation</h3>

            {/* Revision Info */}
            <div className="space-y-3 mb-6 pb-6 border-b">
              <div>
                <span className="text-sm font-medium text-gray-600">Type:</span>
                <div className="mt-1">
                  <Badge variant="default" className="bg-amber-600">Place Update</Badge>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">Place Status:</span>
                <div className="mt-1">
                  <Badge variant="default">Published</Badge>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">Revision Status:</span>
                <div className="mt-1">
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">Pending</Badge>
                </div>
              </div>

              {place.city && (
                <div>
                  <span className="text-sm font-medium text-gray-600">City:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.city.name}</p>
                </div>
              )}

              {place.owner.business && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Business:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.owner.business.name}</p>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-600">Submitted:</span>
                <p className="text-sm text-gray-900 mt-1">
                  {revision.submittedAt ? formatDistanceToNow(revision.submittedAt, { addSuffix: true, locale: ru }) : "—"}
                </p>
              </div>
            </div>

            {/* Moderator Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Комментарий модератора
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Укажите причину отклонения или необходимые правки..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={() => handleModerate("APPROVE")}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Processing..." : "Approve Changes"}
              </Button>

              <Button
                onClick={() => handleModerate("NEEDS_REVISION")}
                disabled={isSubmitting}
                variant="outline"
                className="w-full"
              >
                Needs Revision
              </Button>

              <Button
                onClick={() => handleModerate("REJECT")}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
              >
                Reject Changes
              </Button>
            </div>

            {/* Info Note */}
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Approving will copy the changes to the live Place. The current version remains visible until approval.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
