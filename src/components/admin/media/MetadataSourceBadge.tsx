import { MetadataSource } from "@/lib/media/generateMediaMetadata";

interface MetadataSourceBadgeProps {
  source: MetadataSource;
}

export function MetadataSourceBadge({ source }: MetadataSourceBadgeProps) {
  if (source === "manual") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Вручную
      </span>
    );
  }

  if (source === "auto") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
        Авто
      </span>
    );
  }

  return null;
}
