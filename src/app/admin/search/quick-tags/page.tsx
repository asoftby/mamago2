"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchLayout } from "@/components/admin/search/SearchLayout";
import { Tag, Plus, GripVertical, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickTagModal } from "@/components/admin/search/QuickTagModal";
import type { SearchQuickTagWithCity } from "@/types/search-quick-tag";
import { TableContainer } from "@/components/ui/table";

export default function QuickTagsPage() {
  const searchParams = useSearchParams();
  const [tags, setTags] = useState<SearchQuickTagWithCity[]>([]);
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<SearchQuickTagWithCity | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [prefilledQuery, setPrefilledQuery] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
    loadCities();
    
    // Check for pre-filled query from URL params
    const queryParam = searchParams.get("query");
    if (queryParam) {
      setPrefilledQuery(queryParam);
      setModalOpen(true);
    }
  }, [searchParams]);

  async function loadTags() {
    try {
      const response = await fetch("/api/admin/search/quick-tags");
      const data = await response.json();
      if (data.success) {
        setTags(data.data.tags);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCities() {
    try {
      const response = await fetch("/api/public/cities");
      const data = await response.json();
      if (data.success) {
        setCities(data.data.cities);
      }
    } catch (error) {
      console.error("Failed to load cities:", error);
    }
  }

  async function handleSave(data: Record<string, unknown>) {
    const url = editingTag
      ? `/api/admin/search/quick-tags/${editingTag.id}`
      : "/api/admin/search/quick-tags";

    const method = editingTag ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to save tag");
    }

    await loadTags();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quick tag?")) return;

    try {
      const response = await fetch(`/api/admin/search/quick-tags/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await loadTags();
      } else {
        alert(result.error || "Failed to delete tag");
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("Failed to delete tag");
    }
  }

  async function handleReorder(newOrder: SearchQuickTagWithCity[]) {
    setTags(newOrder);

    try {
      const response = await fetch("/api/admin/search/quick-tags/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newOrder.map((t) => t.id) }),
      });

      const result = await response.json();

      if (!result.success) {
        // Revert on error
        await loadTags();
      }
    } catch (error) {
      console.error("Failed to reorder tags:", error);
      await loadTags();
    }
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTags = [...tags];
    const draggedTag = newTags[draggedIndex];
    newTags.splice(draggedIndex, 1);
    newTags.splice(index, 0, draggedTag);

    setTags(newTags);
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    if (draggedIndex !== null) {
      handleReorder(tags);
    }
    setDraggedIndex(null);
  }

  const activeTags = tags.filter((t) => t.isActive);

  return (
    <SearchLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quick Tags</h2>
            <p className="text-gray-600 mt-1">
              Manage quick search tags that appear under the search bar
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingTag(null);
              setModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Quick Tag
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Tags</p>
                <p className="text-2xl font-bold text-gray-900">{tags.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Tags</p>
                <p className="text-2xl font-bold text-gray-900">{activeTags.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Inactive Tags</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tags.length - activeTags.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        {activeTags.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Preview (as shown to users)
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeTags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
                >
                  {tag.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Tags</h3>
            <p className="text-sm text-gray-600 mt-1">
              Drag and drop to reorder tags
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : tags.length === 0 ? (
            <div className="p-12 text-center">
              <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No quick tags yet</p>
              <Button
                onClick={() => {
                  setEditingTag(null);
                  setModalOpen(true);
                }}
                className="mt-4"
              >
                Create your first tag
              </Button>
            </div>
          ) : (
            <TableContainer
              minWidthClassName="min-w-[820px]"
              scrollLabel="Быстрые теги, прокручивается по горизонтали"
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-12"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Query
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sort
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tags.map((tag, index) => (
                    <tr
                      key={tag.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`hover:bg-gray-50 transition-colors cursor-move ${
                        draggedIndex === index ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Tag className="w-4 h-4 text-gray-400 mr-3" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {tag.title}
                            </span>
                            <p className="text-xs text-gray-500">{tag.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{tag.query}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {tag.city?.name || "All cities"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tag.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{tag.sortOrder}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTag(tag);
                            setModalOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tag.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>
          )}
        </div>
      </div>

      {/* Modal */}
      <QuickTagModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTag(null);
          setPrefilledQuery(null);
        }}
        onSave={handleSave}
        tag={editingTag}
        cities={cities}
        prefilledQuery={prefilledQuery}
      />
    </SearchLayout>
  );
}
