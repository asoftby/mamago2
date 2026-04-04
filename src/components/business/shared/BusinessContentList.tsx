"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDestructiveActionDialog } from "@/components/ui/confirm-destructive-action-dialog";

interface BusinessContentListProps<T> {
  items: T[];
  currentView: "active" | "archived";
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  addButtonText: string;
  addButtonHref: string;
  renderItem: (item: T, handlers: ItemHandlers) => ReactNode;
  onDelete?: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
  deleteEntityLabel?: string;
  getDeleteEntityName?: (item: T) => string | undefined;
}

export interface ItemHandlers {
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
}

export function BusinessContentList<T extends { id: string }>({
  items: initialItems,
  currentView,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  addButtonText,
  addButtonHref,
  renderItem,
  onDelete: onDeleteProp,
  onRestore: onRestoreProp,
  onArchive: onArchiveProp,
  onUnarchive: onUnarchiveProp,
  deleteEntityLabel = "элемент",
  getDeleteEntityName,
}: BusinessContentListProps<T>) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const pendingDeleteItem =
    pendingDeleteId != null ? items.find((x) => x.id === pendingDeleteId) : null;
  const pendingDeleteName = pendingDeleteItem
    ? getDeleteEntityName?.(pendingDeleteItem)
    : undefined;

  const requestDelete = async (itemId: string) => {
    setPendingDeleteId(itemId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    if (onDeleteProp) {
      setDeleteLoading(true);
      try {
        await onDeleteProp(itemId);
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        router.refresh();

        toast.success("Удалено", {
          description: pendingDeleteName
            ? `Удалено «${pendingDeleteName}».`
            : undefined,
          action: onRestoreProp
            ? {
                label: "Отменить",
                onClick: async () => {
                  try {
                    await onRestoreProp(itemId);
                    router.refresh();
                    toast.success("Восстановлено");
                  } catch {
                    toast.error("Не удалось восстановить");
                  }
                },
              }
            : undefined,
          duration: 8000,
        });
      } finally {
        setDeleteLoading(false);
        setDeleteDialogOpen(false);
        setPendingDeleteId(null);
      }
    }
  };

  const handleArchive = async (itemId: string) => {
    if (onArchiveProp) {
      await onArchiveProp(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      router.refresh();
    }
  };

  const handleUnarchive = async (itemId: string) => {
    if (onUnarchiveProp) {
      await onUnarchiveProp(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      router.refresh();
    }
  };

  const handleViewChange = (view: "active" | "archived") => {
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?view=${view}`);
  };

  const handlers: ItemHandlers = {
    onDelete: requestDelete,
    onArchive: currentView === "active" ? handleArchive : undefined,
    onUnarchive: currentView === "archived" ? handleUnarchive : undefined,
  };

  if (items.length === 0) {
    return (
      <div>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => handleViewChange("active")}
            className={`px-4 py-2 font-medium transition-colors ${
              currentView === "active"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => handleViewChange("archived")}
            className={`px-4 py-2 font-medium transition-colors ${
              currentView === "archived"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Архив
          </button>
        </div>

        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {emptyIcon}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentView === "active" ? emptyTitle : "Нет архивных элементов"}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {currentView === "active" ? emptyDescription : "Архивные элементы будут отображаться здесь"}
            </p>
            {currentView === "active" && (
              <a
                href={addButtonHref}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {addButtonText}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDestructiveActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Удалить ${deleteEntityLabel}?`}
        description={
          pendingDeleteName
            ? `Вы уверены, что хотите удалить «${pendingDeleteName}»?`
            : "Вы уверены, что хотите удалить?"
        }
        loading={deleteLoading}
        onConfirm={() => (pendingDeleteId ? handleDelete(pendingDeleteId) : undefined)}
        onCancel={() => setPendingDeleteId(null)}
      />
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => handleViewChange("active")}
          className={`px-4 py-2 font-medium transition-colors ${
            currentView === "active"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Активные
        </button>
        <button
          onClick={() => handleViewChange("archived")}
          className={`px-4 py-2 font-medium transition-colors ${
            currentView === "archived"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Архив
        </button>
      </div>

      {/* Add Button */}
      {currentView === "active" && (
        <div className="flex justify-end">
          <a
            href={addButtonHref}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {addButtonText}
          </a>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {items.map((item) => renderItem(item, handlers))}
      </div>
    </div>
  );
}
