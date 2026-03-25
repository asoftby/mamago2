import { Label } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

/** Результат `useAutoSlug` — без импорта typeof для стабильных типов. */
export type DiscoveryAutoSlugBinding = {
  source: string;
  slug: string;
  setSource: (v: string) => void;
  setSlug: (v: string) => void;
};

export function DiscoveryTitleSlugCreateRow({
  titleLabel = "Название (Title)",
  slugLabel = "Slug",
  auto,
  onCreate,
  titlePlaceholder,
  slugPlaceholder,
}: {
  titleLabel?: string;
  slugLabel?: string;
  auto: DiscoveryAutoSlugBinding;
  onCreate: () => void;
  titlePlaceholder?: string;
  slugPlaceholder?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-end">
      <div className="grid gap-2 flex-1 min-w-0">
        <Label>{titleLabel}</Label>
        <Input
          value={auto.source}
          onChange={(e) => auto.setSource(e.target.value)}
          placeholder={titlePlaceholder}
        />
      </div>
      <div className="grid gap-2 flex-1 min-w-0">
        <Label>{slugLabel}</Label>
        <Input
          className="font-mono text-sm"
          value={auto.slug}
          onChange={(e) => auto.setSlug(e.target.value)}
          placeholder={slugPlaceholder}
        />
      </div>
      <Button type="button" onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        Create
      </Button>
    </div>
  );
}
