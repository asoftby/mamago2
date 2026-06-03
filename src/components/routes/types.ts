import { LEGACY_BUDGET_LABELS } from "@/lib/routes/routeBudget";

export type PublicRouteStop = {
  id: string;
  order: number;
  title?: string;
  address: string;
  note: string;
  photoUrl?: string;
  photos?: string[];
  lat?: number;
  lng?: number;
};

export type PublicRouteCardModel = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: "FREE" | "LOW" | "MEDIUM" | "HIGH";
  budgetLabel: string;
  budgetNote?: string | null;
  cityName: string;
  coverImageUrl: string;
  authorName: string | null;
  authorAvatar?: string;
  isEditorial: boolean;
  stopsCount: number;
  stops: PublicRouteStop[];
  createdAt?: string;
  updatedAt?: string;
};

export const BUDGET_LABELS: Record<PublicRouteCardModel["budgetLevel"], string> =
  LEGACY_BUDGET_LABELS;
