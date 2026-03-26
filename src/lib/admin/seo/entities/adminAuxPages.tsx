import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import type { SeoEntityType } from "./types";
import { buildEntitySchema, loadEntityRedirects, loadEntityEditorModel } from "./service";

export async function renderEntitySchemaPage(kind: SeoEntityType, id: string) {
  const [entity, jsonLd] = await Promise.all([
    loadEntityEditorModel(kind, id),
    buildEntitySchema(kind, id),
  ]);

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Schema.org"
        subtitle={entity ? `${kind}: ${entity.title}` : kind}
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold">JSON-LD</div>
        {!jsonLd ? (
          <div className="px-5 py-10 text-center text-sm text-gray-600">
            Нет данных для генерации schema
          </div>
        ) : (
          <pre className="p-5 text-xs overflow-x-auto bg-gray-50/30">
            {JSON.stringify(jsonLd, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export async function renderEntityRedirectsPage(kind: SeoEntityType, id: string) {
  const [entity, redirects] = await Promise.all([
    loadEntityEditorModel(kind, id),
    loadEntityRedirects(kind, id),
  ]);

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Redirects"
        subtitle={entity ? `${kind}: ${entity.title}` : kind}
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold">
          Текущий slug:{" "}
          <span className="font-mono text-xs">{redirects.currentSlug ?? "—"}</span>
        </div>
        {redirects.history.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-600">Истории редиректов нет</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-700">Old slug</th>
                <th className="px-5 py-3 font-semibold text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {redirects.history.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/80">
                  <td className="px-5 py-3 font-mono text-xs text-gray-800">{r.slug}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

