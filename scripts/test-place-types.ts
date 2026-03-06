/**
 * Test TypeScript types for Place and PlaceImage
 * This file should compile without errors
 */

import type { Place, PlaceImage, Prisma } from "@prisma/client";
import { ContentStatus, LocationSource, PlaceImageKind } from "@prisma/client";

// Test 1: Place type
const place: Place = {
  id: "test-id",
  ownerUserId: "user-id",
  status: ContentStatus.DRAFT,
  title: "Test Place",
  category: "cafe",
  shortDesc: "Short description",
  description: null,
  logoImageId: null,
  googlePlaceId: null,
  lat: null,
  lng: null,
  formattedAddr: null,
  addressJson: null,
  countryCode: null,
  cityId: null,
  locationSource: LocationSource.MANUAL,
  customAddress: null,
  phone: null,
  website: null,
  instagramHandle: null,
  instagramUrl: null,
  ageTags: [],
  visitFormats: [],
  activityTypes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test 2: PlaceImage type
const placeImage: PlaceImage = {
  id: "image-id",
  placeId: "place-id",
  kind: PlaceImageKind.LOGO,
  url: "https://example.com/image.jpg",
  width: 400,
  height: 400,
  blurhash: null,
  sortOrder: 0,
  createdAt: new Date(),
};

// Test 3: Prisma create input
const createPlaceInput: Prisma.PlaceCreateInput = {
  owner: { connect: { id: "user-id" } },
  title: "New Place",
  category: "museum",
  shortDesc: "A new place",
  status: ContentStatus.DRAFT,
  locationSource: LocationSource.GOOGLE,
  googlePlaceId: "ChIJ...",
  lat: 53.9,
  lng: 27.5,
  ageTags: ["3-7", "7-12"],
  visitFormats: ["indoor", "outdoor"],
  activityTypes: ["education", "entertainment"],
};

// Test 4: Prisma update input
const updatePlaceInput: Prisma.PlaceUpdateInput = {
  status: ContentStatus.PUBLISHED,
  logoImageId: "logo-image-id",
  description: "Updated description",
};

// Test 5: Prisma where input
const wherePlaceInput: Prisma.PlaceWhereInput = {
  status: ContentStatus.PUBLISHED,
  ownerUserId: "user-id",
  category: { in: ["cafe", "restaurant"] },
  ageTags: { hasSome: ["0-3", "3-7"] },
};

// Test 6: PlaceImage create input
const createImageInput: Prisma.PlaceImageCreateInput = {
  place: { connect: { id: "place-id" } },
  kind: PlaceImageKind.GALLERY,
  url: "https://example.com/gallery.jpg",
  width: 1920,
  height: 1080,
  blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
  sortOrder: 1,
};

// Test 7: Enum values
const statuses: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.PENDING,
  ContentStatus.PUBLISHED,
  ContentStatus.NEEDS_CHANGES,
  ContentStatus.REJECTED,
];

const locationSources: LocationSource[] = [
  LocationSource.GOOGLE,
  LocationSource.MANUAL,
];

const imageKinds: PlaceImageKind[] = [
  PlaceImageKind.LOGO,
  PlaceImageKind.GALLERY,
];

console.log("✅ All TypeScript types are valid!");
console.log("Statuses:", statuses.length);
console.log("Location sources:", locationSources.length);
console.log("Image kinds:", imageKinds.length);
