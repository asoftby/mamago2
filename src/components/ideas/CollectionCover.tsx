import { FolderHeart } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollectionCover({ covers = [], className }: { covers?: string[]; className?: string }) {
  const images = covers.filter(Boolean).slice(0, 4);
  return <span className={cn("grid aspect-[3/2] gap-0.5 overflow-hidden rounded-2xl bg-stone-100",
    images.length > 1 && "grid-cols-[2fr_1fr]", images.length > 2 && "grid-rows-2", className)}>
    {images.length ? images.map((url, index) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={`${index}-${url}`} src={url} alt="" loading="lazy"
        className={cn("h-full min-h-0 w-full object-cover", images.length === 3 && index === 0 && "row-span-2")} />
    )) : <span className="flex h-full items-center justify-center text-stone-300"><FolderHeart className="size-6" /></span>}
  </span>;
}
