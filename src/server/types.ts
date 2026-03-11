/**
 * Server-side type definitions
 * Re-exports Prisma types to avoid direct imports in service files
 */

import type { 
  PrismaClient, 
  Place, 
  Offer,
  PlaceImage,
  PlaceRevisionImage,
  TempMedia,
  OpeningHoursRule,
  OpeningHoursInterval,
  Prisma
} from "@prisma/client";

// Re-export commonly used Prisma types for server services
export type { 
  PrismaClient, 
  Place, 
  Offer,
  PlaceImage,
  PlaceRevisionImage,
  TempMedia,
  OpeningHoursRule,
  OpeningHoursInterval,
  Prisma
};