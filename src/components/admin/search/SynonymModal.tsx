"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SearchSynonym } from "@/types/search-synonym";

interface SynonymModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { source: string; targets: string[]; isActive: boolean }) => Promise<void>;
  synonym?: SearchSynonym | null;
  prefilledSource?: string | null;
}

export function SynonymModal({
  isOpen,
  onClose,
  onSave,
  synonym,
  prefilledSource,
}: SynonymModalProps) {
  const [source, setSource] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (synonym) {
      setSource(synonym.source);
      setTargets(synonym.targets);
      setIsActive(synonym.isActive);
    } else if (prefilledSource) {
      setSource(prefilledSource);
      setTargets([]);
      setIsActive(true);
    } else {
      setSource("");
      setTargets([]);
      setIsActive(true);
    }
    setCurrentInput("");
    setError(null);
  }, [synonym, prefilledSource, isOpen]);

  const handleAddTarget = () => {
    const trimmed = currentInput.trim();
    if (trimmed && !targets.includes(trimmed.toLowerCase())) {
      setTargets([...targets, trimmed.toLowerCase()]);
      setCurrentInput("");
    }
  };

  const handleRemoveTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTarget();
    } else if (e.key === "Backspace" && currentInput === "" && targets.length > 0) {
      setTargets(targets.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!source.trim()) {
      setError("Source is required");
      return;
    }

    if (targets.length === 0) {
      setError("At least one synonym is required");
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        source: source.trim(),
        targets,
        isActive,
      });

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save synonym");
    } finally {
      setIsSaving(false);
    }
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
                {synonym ? "Edit Synonym" : "Create Synonym"}
              </h2>
              <p className="text-gray-600 mt-1">
                Map search terms to their synonyms for better results
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Source */}
            <div className="space-y-2">
              <Label htmlFor="source">Source Term *</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="батуты"
                required
              />
              <p className="text-xs text-gray-500">
                The original search term that users might enter
              </p>
            </div>

            {/* Targets (Tags Input) */}
            <div className="space-y-2">
              <Label htmlFor="targets">Synonyms *</Label>
              <div className="border border-gray-300 rounded-lg p-2 min-h-[100px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                <div className="flex flex-wrap gap-2 mb-2">
                  {targets.map((target, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      <span>{target}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget(index)}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleAddTarget}
                  placeholder={targets.length === 0 ? "батутный центр, батутная арена..." : "Add more..."}
                  className="w-full outline-none text-sm"
                />
              </div>
              <p className="text-[13px] text-stone-500">
                Введите слова через запятую. Например: &quot;кино&quot;, &quot;кинотеатр&quot;, &quot;синема&quot;.
              </p>
            </div>

            {/* Example */}
            {source && targets.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Example:</p>
                <p className="text-sm text-blue-700">
                  When users search for <span className="font-semibold">&quot;{source}&quot;</span>,
                  the search will also include results for:{" "}
                  <span className="font-semibold">{targets.join(", ")}</span>
                </p>
              </div>
            )}

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active (apply to search results)
              </Label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "Saving..." : synonym ? "Update Synonym" : "Create Synonym"}
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
