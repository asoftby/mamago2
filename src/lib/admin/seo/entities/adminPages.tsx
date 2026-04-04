import { notFound } from "next/navigation";
import { EntitySeoEditor } from "@/components/admin/seo/EntitySeoEditor";
import type { SeoEntityType } from "./types";
import { loadEntityEditorModel } from "./service";

export async function renderEntitySeoEditorPage(kind: SeoEntityType, id: string) {
  const entity = await loadEntityEditorModel(kind, id);
  if (!entity) return notFound();
  return (
    <div className="space-y-8">
      <EntitySeoEditor kind={kind} entity={entity} />
    </div>
  );
}

