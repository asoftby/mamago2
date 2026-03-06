/**
 * Place Location Service
 * 
 * Unified service for handling place location updates from both:
 * - Google Places autocomplete (has addressJson, googlePlaceId)
 * - Manual map pin (only coordinates)
 * 
 * Pipeline:
 * 1. Persist raw location data (lat/lng, googlePlaceId, formattedAddr, addressJson)
 * 2. Resolve cityId using CityResolver
 * 3. Save cityId to place (with confidence-based update logic)
 * 4. Run geo enrichment (metro + district)
 * 5. Return updated place with all geo fields
 */

import prisma from "@/lib/prisma";
import { LocationSource } from "@prisma/client";
import { resolveCityId } from "./cityResolver.service";
import { enrichPlaceGeo } from "./placeGeoEnrichment.service";

export interface UpdatePlaceLocationInput {
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
  formattedAddr?: string | null;
  addressJson?: any | null;
  countryCode?: string | null;
}

/**
 * Update place location with unified pipeline
 * Handles both Google autocomplete and manual pin flows
 */
export async function updatePlaceLocation(
  placeId: string,
  input: UpdatePlaceLocationInput
) {
  console.log(`[placeLocation] 🔄 Starting update for place ${placeId}`);
  console.log(`[placeLocation] Input:`, JSON.stringify(input, null, 2));

  try {
    // STEP 1: Get existing place data
    console.log(`[placeLocation] Step 1: Fetching existing place...`);
    const existingPlace = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        cityId: true,
        lat: true,
        lng: true,
      },
    });

    if (!existingPlace) {
      throw new Error(`Place ${placeId} not found`);
    }
    console.log(`[placeLocation] ✅ Found place, existing cityId: ${existingPlace.cityId || "null"}`);

    // STEP 2: Persist raw location fields
    console.log(`[placeLocation] Step 2: Persisting location data...`);
    const locationSource = input.googlePlaceId
      ? LocationSource.GOOGLE
      : LocationSource.MANUAL;

    await prisma.place.update({
      where: { id: placeId },
      data: {
        lat: input.lat,
        lng: input.lng,
        locationSource,
        googlePlaceId: input.googlePlaceId || null,
        formattedAddr: input.formattedAddr || null,
        addressJson: input.addressJson || null,
        countryCode: input.countryCode || null,
        customAddress: locationSource === LocationSource.MANUAL ? input.formattedAddr : null,
      },
    });

    console.log(`[placeLocation] ✅ Persisted location data`);

    // STEP 3: Resolve cityId
    console.log(`[placeLocation] Step 3: Resolving cityId...`);
    const cityResolution = await resolveCityId({
      lat: input.lat,
      lng: input.lng,
      addressJson: input.addressJson,
      existingCityId: existingPlace.cityId,
    });
    console.log(`[placeLocation] City resolution result:`, cityResolution);

    // STEP 4: Update cityId if resolution succeeded and should update
    if (cityResolution.cityId && cityResolution.shouldUpdate) {
      console.log(`[placeLocation] Step 4: Updating cityId...`);
      await prisma.place.update({
        where: { id: placeId },
        data: { cityId: cityResolution.cityId },
      });
      console.log(
        `[placeLocation] ✅ Updated cityId: ${cityResolution.cityId} (confidence: ${cityResolution.confidence})`
      );
    } else if (cityResolution.cityId && !cityResolution.shouldUpdate) {
      console.log(
        `[placeLocation] ℹ️ Resolved cityId: ${cityResolution.cityId} but keeping existing (confidence: ${cityResolution.confidence})`
      );
    } else {
      console.log(`[placeLocation] ⚠️ Could not resolve cityId`);
    }

    // STEP 5: Run geo enrichment (metro + district)
    console.log(`[placeLocation] Step 5: Running geo enrichment...`);
    let enrichedPlace;
    try {
      enrichedPlace = await enrichPlaceGeo(placeId);
      if (enrichedPlace) {
        console.log(`[placeLocation] ✅ Geo enrichment completed`);
      } else {
        console.log(`[placeLocation] ⚠️ Geo enrichment returned null`);
      }
    } catch (enrichError) {
      console.error(`[placeLocation] ❌ Geo enrichment error (non-fatal):`, enrichError);
      // Continue without enrichment
    }

    // STEP 6: Return updated place with all fields
    console.log(`[placeLocation] Step 6: Fetching final place data...`);
    const updatedPlace = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        lat: true,
        lng: true,
        cityId: true,
        googlePlaceId: true,
        formattedAddr: true,
        addressJson: true,
        countryCode: true,
        locationSource: true,
        districtAutoId: true,
        districtManualId: true,
        metroAutoId: true,
        metroAutoDistanceM: true,
        metroManualId: true,
        metroManualDistanceM: true,
        city: {
          select: {
            id: true,
            name: true,
            hasMetro: true,
            metroMaxDistanceM: true,
          },
        },
        districtAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        districtManual: {
          select: {
            id: true,
            name: true,
          },
        },
        metroAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        metroManual: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`[placeLocation] ✅ Location update complete for place ${placeId}`);

    return updatedPlace;
  } catch (error) {
    console.error(`[placeLocation] ❌ Error updating location for place ${placeId}:`, error);
    console.error(`[placeLocation] Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : "No stack",
    });
    throw error;
  }
}
