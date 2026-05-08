"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageType, PageStatus, PageVisibility } from "@prisma/client";
import { toast } from "sonner";
import { generateSlugFromTitle } from "@/lib/pages/validation";
import { Save, Eye, Archive, X } from "lucide-react";

type PageFormProps = {
  mode: "create" | "edit";
  pageId?: string;
  initialData?: {
    title: string;
    slug: string;
    type: PageType;
    status: PageStatus;
    visibility: PageVisibility;
    excerpt?: string | null;
    content?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    ogImageUrl?: string | null;
  };
};

export function PageForm({ mode, pageId, initialData }: PageFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    type: initialData?.type || ("LEGAL" as PageType),
    status: initialData?.status || ("DRAFT" as PageStatus),
    visibility: initialData?.visibility || ("PUBLIC" as PageVisibility),
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    seoTitle: initialData?.seoTitle || "",
    seoDescription: initialData?.seoDescription || "",
    ogImageUrl: initialData?.ogImageUrl || "",
  });

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && formData.title && mode === "create") {
      setFormData((prev) => ({
        ...prev,
        slug: generateSlugFromTitle(formData.title),
      }));
    }
  }, [formData.title, slugManuallyEdited, mode]);

  async function handleSubmit(publishNow: boolean = false) {
    if (!formData.title || !formData.slug) {
      toast.error("Заполните обязательные поля");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        status: publishNow ? "PUBLISHED" : formData.status,
        excerpt: formData.excerpt || null,
        content: formData.content || null,
        seoTitle: formData.seoTitle || null,
        seoDescription: formData.seoDescription || null,
        ogImageUrl: formData.ogImageUrl || null,
      };

      if (mode === "create") {
        const response = await fetch("/api/admin/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create page");
        }

        const page = await response.json();
        toast.success("Страница создана");
        router.push(`/admin/pages/${page.id}/edit`);
      } else {
        const response = await fetch(`/api/admin/pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update page");
        }

        toast.success("Страница обновлена");
        router.refresh();
      }
    } catch (error) {
      console.error("Error saving page:", error);
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить страницу");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!pageId) return;
    if (!confirm("Вы уверены, что хотите архивировать эту страницу?")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/pages/${pageId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to archive page");

      toast.success("Страница архивирована");
      router.push("/admin/pages");
    } catch (error) {
      console.error("Error archiving page:", error);
      toast.error("Не удалось архивировать страницу");
    } finally {
      setLoading(false);
    }
  }

  function getPublicUrl(): string {
    if (formData.type === "LEGAL") {
      return `/legal/${formData.slug}`;
    }
    return `/page/${formData.slug}`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Основное</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Политика конфиденциальности"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setFormData({ ...formData, slug: e.target.value });
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="privacy-policy"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL: {formData.type === "LEGAL" ? "/legal/" : "/page/"}
              {formData.slug || "slug"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип страницы <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as PageType })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="LEGAL">Юридические</option>
                <option value="MARKETING">Маркетинг</option>
                <option value="LANDING">Лендинги</option>
                <option value="FAQ">FAQ</option>
                <option value="SYSTEM">Системные</option>
                <option value="SEO">SEO</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Видимость</label>
              <select
                value={formData.visibility}
                onChange={(e) =>
                  setFormData({ ...formData, visibility: e.target.value as PageVisibility })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PUBLIC">Публичная</option>
                <option value="UNLISTED">По ссылке</option>
                <option value="PRIVATE">Приватная</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Краткое описание
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Краткое описание страницы"
            />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Контент</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Текст страницы</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={15}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="HTML или текст страницы"
            />
            <p className="text-xs text-gray-500 mt-1">
              Поддерживается HTML. Будьте осторожны с безопасностью.
            </p>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">SEO</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
            <input
              type="text"
              value={formData.seoTitle}
              onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Заголовок для поисковых систем"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
            <textarea
              value={formData.seoDescription}
              onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Описание для поисковых систем"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OG Image URL</label>
            <input
              type="url"
              value={formData.ogImageUrl}
              onChange={(e) => setFormData({ ...formData, ogImageUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Действия</h2>

          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {mode === "create" ? "Сохранить черновик" : "Сохранить"}
          </button>

          {formData.status !== "PUBLISHED" && (
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              Опубликовать
            </button>
          )}

          {mode === "edit" && formData.status === "PUBLISHED" && (
            <a
              href={getPublicUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Смотреть на сайте
            </a>
          )}

          {mode === "edit" && (
            <button
              onClick={handleArchive}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              В архив
            </button>
          )}

          <button
            onClick={() => router.push("/admin/pages")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Отмена
          </button>
        </div>

        {/* Info */}
        {mode === "edit" && initialData && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Информация</h2>

            <div>
              <p className="text-xs text-gray-500">Статус</p>
              <p className="text-sm font-medium text-gray-900">{initialData.status}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Тип</p>
              <p className="text-sm font-medium text-gray-900">{initialData.type}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Видимость</p>
              <p className="text-sm font-medium text-gray-900">{initialData.visibility}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Публичный URL</p>
              <p className="text-sm font-medium text-gray-900 break-all">{getPublicUrl()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
