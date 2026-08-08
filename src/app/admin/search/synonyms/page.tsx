"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchLayout } from "@/components/admin/search/SearchLayout";
import { ArrowRight, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SynonymModal } from "@/components/admin/search/SynonymModal";
import type { SearchSynonym } from "@/types/search-synonym";

export default function SynonymsPage() {
  const searchParams = useSearchParams();
  const [synonyms, setSynonyms] = useState<SearchSynonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSynonym, setEditingSynonym] = useState<SearchSynonym | null>(null);
  const [prefilledSource, setPrefilledSource] = useState<string | null>(null);

  useEffect(() => {
    loadSynonyms();
    
    // Check for pre-filled source from URL params
    const sourceParam = searchParams.get("source");
    if (sourceParam) {
      setPrefilledSource(sourceParam);
      setModalOpen(true);
    }
  }, [searchParams]);

  async function loadSynonyms() {
    try {
      const response = await fetch("/api/admin/search/synonyms");
      const data = await response.json();
      if (data.success) {
        setSynonyms(data.data.synonyms);
      }
    } catch (error) {
      console.error("Failed to load synonyms:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: Record<string, unknown>) {
    const url = editingSynonym
      ? `/api/admin/search/synonyms/${editingSynonym.id}`
      : "/api/admin/search/synonyms";

    const method = editingSynonym ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Не удалось сохранить синоним");
    }

    await loadSynonyms();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить этот синоним?")) return;

    try {
      const response = await fetch(`/api/admin/search/synonyms/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await loadSynonyms();
      } else {
        alert(result.error || "Не удалось удалить синоним");
      }
    } catch (error) {
      console.error("Failed to delete synonym:", error);
      alert("Не удалось удалить синоним");
    }
  }

  async function handleToggleActive(synonym: SearchSynonym) {
    try {
      const response = await fetch(`/api/admin/search/synonyms/${synonym.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !synonym.isActive }),
      });

      const result = await response.json();

      if (result.success) {
        await loadSynonyms();
      } else {
        alert(result.error || "Не удалось обновить синоним");
      }
    } catch (error) {
      console.error("Failed to update synonym:", error);
      alert("Не удалось обновить синоним");
    }
  }

  const activeSynonyms = synonyms.filter((s) => s.isActive);
  const totalTargets = synonyms.reduce((sum, s) => sum + s.targets.length, 0);

  return (
    <SearchLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Синонимы поиска</h2>
            <p className="text-gray-600 mt-1">
              Управление группами синонимов
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingSynonym(null);
              setModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить синоним
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Групп синонимов</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{synonyms.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Всего синонимов</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalTargets}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Активных групп</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{activeSynonyms.length}</p>
          </div>
        </div>

        {/* Honest disclosure: NOT actually applied to the live search query today */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-amber-900">
            Сейчас не влияет на живой поиск
          </h3>
          <p className="text-sm text-amber-800 mt-1">
            Синонимы сохраняются здесь, но публичный поиск (<code className="mx-1 px-1 py-0.5 rounded bg-amber-100">/api/search</code>)
            их пока не читает — расширения запроса по синонимам не происходит.
            Список ниже — подготовка данных на будущее, а не действующее правило поиска.
          </p>
        </div>

        {/* Synonyms List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : synonyms.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-12 text-center">
            <ArrowRight className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Синонимов пока нет</p>
            <Button
              onClick={() => {
                setEditingSynonym(null);
                setModalOpen(true);
              }}
              className="mt-4"
            >
              Создать первый синоним
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {synonyms.map((synonym) => (
              <div
                key={synonym.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-lg font-semibold text-gray-900">
                        {synonym.source}
                      </span>
                      {synonym.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Неактивен
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-gray-600">Синонимы:</span>
                      {synonym.targets.map((target, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                            {target}
                          </span>
                          {index < synonym.targets.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Обновлено {new Date(synonym.updatedAt).toLocaleDateString("ru-RU")}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(synonym)}
                    >
                      {synonym.isActive ? "Деактивировать" : "Активировать"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSynonym(synonym);
                        setModalOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(synonym.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <SynonymModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSynonym(null);
          setPrefilledSource(null);
        }}
        onSave={handleSave}
        synonym={editingSynonym}
        prefilledSource={prefilledSource}
      />
    </SearchLayout>
  );
}
