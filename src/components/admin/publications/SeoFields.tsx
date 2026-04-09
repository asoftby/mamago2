"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SeoSectionFields({
  titleId = "seo-title",
  descId = "seo-desc",
}: {
  titleId?: string;
  descId?: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">SEO</h3>
      <div className="space-y-2">
        <Label htmlFor={titleId} className="text-xs text-gray-600">
          Meta title
        </Label>
        <Input id={titleId} placeholder="Заголовок для поиска" className="bg-white" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={descId} className="text-xs text-gray-600">
          Meta description
        </Label>
        <Textarea id={descId} rows={3} placeholder="Краткое описание" className="bg-white resize-y min-h-[80px]" />
      </div>
    </section>
  );
}
