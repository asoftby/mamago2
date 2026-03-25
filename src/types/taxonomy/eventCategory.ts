/** Строка списка категорий событий (админ API). */
export type EventCategoryAdminRow = {
  id: string;
  nameRu: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  parentId: string | null;
  parent: { id: string; nameRu: string; slug: string } | null;
  options?: Array<{
    id: string;
    label: string;
    value: string;
    order: number;
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
  _count: { activities: number; children: number };
};
