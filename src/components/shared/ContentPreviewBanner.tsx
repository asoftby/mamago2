import Link from "next/link";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContentPreviewBannerProps {
  label: string;
  editHref?: string;
  editLabel?: string;
  hint?: string;
}

export function ContentPreviewBanner({
  label,
  editHref,
  editLabel = "Вернуться к редактированию",
  hint,
}: ContentPreviewBannerProps) {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-start justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-amber-100 px-3 text-sm font-semibold text-amber-900">
              Предпросмотр
            </span>
            <p className="truncate text-sm font-medium text-amber-950">{label}</p>
          </div>
          {hint ? (
            <p className="mt-1 text-sm text-amber-900/80">
              {hint}
            </p>
          ) : null}
        </div>

        {editHref ? (
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 bg-white/90">
            <Link href={editHref}>
              <PencilLine className="mr-2 h-4 w-4" aria-hidden />
              {editLabel}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
