import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSegmentDetailClient } from "@/components/admin/analytics/AdminSegmentDetailClient";

export default async function AdminSegmentDetailPage({
  params,
}: {
  params: Promise<{ segmentKey: string }>;
}) {
  const { segmentKey } = await params;

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Segment"
        subtitle="Audience behaviour and value signals"
        backHref="/admin/analytics"
      />
      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <AdminSegmentDetailClient segmentKey={segmentKey} />
      </Suspense>
    </div>
  );
}
