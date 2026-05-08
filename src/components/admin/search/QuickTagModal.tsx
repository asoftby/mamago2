"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SearchQuickTagWithCity } from "@/types/search-quick-tag";

interface QuickTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    slug: string;
    query: string;
    filters: Record<string, unknown> | null;
    cityId: string | null;
    isActive: boolean;
    sortOrder: number;
  }) => Promise<void>;
  tag?: SearchQuickTagWithCity | null;
  cities: Array<{ id: string; name: string }>;
  prefilledQuery?: string | null;
}

export function QuickTagModal({
  isOpen,
  onClose,
  onSave,
  tag,
  cities,
  prefilledQuery,
}: QuickTagModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    query: "",
    filters: "",
    cityId: "",
    isActive: true,
    sortOrder: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tag) {
      setFormData({
        title: tag.title,
        slug: tag.slug,
        query: tag.query,
        filters: tag.filters ? JSON.stringify(tag.filters, null, 2) : "",
        cityId: tag.cityId || "",
        isActive: tag.isActive,
        sortOrder: tag.sortOrder,
      });
    } else if (prefilledQuery) {
      setFormData({
        title: prefilledQuery.charAt(0).toUpperCase() + prefilledQuery.slice(1),
        slug: prefilledQuery.toLowerCase().replace(/\s+/g, "-"),
        query: prefilledQuery,
        filters: "",
        cityId: "",
        isActive: true,
        sortOrder: 0,
      });
    } else {
      setFormData({
        title: "",
        slug: "",
        query: "",
        filters: "",
        cityId: "",
        isActive: true,
        sortOrder: 0,
      });
    }
    setError(null);
  }, [tag, prefilledQuery, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Parse filters JSON if provided
      let parsedFilters = null;
      if (formData.filters.trim()) {
        try {
          parsedFilters = JSON.parse(formData.filters);
        } catch (err) {
          setError("Invalid JSON in filters field");
          setIsSaving(false);
          return;
        }
      }

      await onSave({
        title: formData.title,
        slug: formData.slug,
        query: formData.query,
        filters: parsedFilters,
        cityId: formData.cityId || null,
        isActive: formData.isActive,
        sortOrder: formData.sortOrder,
      });

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setIsSaving(false);
    }
  };

  const generateSlug = () => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9а-я]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setFormData({ ...formData, slug });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {tag ? "Edit Quick Tag" : "Create Quick Tag"}
              </h2>
              <p className="text-gray-600 mt-1">
                Quick tags appear under the search bar
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Театр"
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="slug">Slug *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateSlug}
                >
                  Generate from title
                </Button>
              </div>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="teatr"
                required
              />
            </div>

            {/* Query */}
            <div className="space-y-2">
              <Label htmlFor="query">Search Query *</Label>
              <Input
                id="query"
                value={formData.query}
                onChange={(e) =>
                  setFormData({ ...formData, query: e.target.value })
                }
                placeholder="театр"
                required
              />
              <p className="text-xs text-gray-500">
                The search query that will be executed when user clicks this tag
              </p>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <Label htmlFor="filters">Filters (JSON, optional)</Label>
              <Textarea
                id="filters"
                value={formData.filters}
                onChange={(e) =>
                  setFormData({ ...formData, filters: e.target.value })
                }
                placeholder='{"category": "entertainment", "ageMin": 3}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Optional JSON object with additional search filters
              </p>
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="cityId">City (optional)</Label>
              <select
                id="cityId"
                value={formData.cityId}
                onChange={(e) =>
                  setFormData({ ...formData, cityId: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All cities</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sortOrder: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-gray-500">
                Lower numbers appear first (can also drag-and-drop in the table)
              </p>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active (visible to users)
              </Label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "Saving..." : tag ? "Update Tag" : "Create Tag"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
