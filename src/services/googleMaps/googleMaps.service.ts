/**
 * Google Maps Service
 * 
 * Production-grade singleton service for loading and accessing Google Maps JavaScript API.
 * Optimized for Belarus region with Russian language support.
 * Uses the new @googlemaps/js-api-loader API (setOptions/importLibrary).
 * 
 * @example
 * ```typescript
 * import { GoogleMapsService } from '@/services/googleMaps';
 * 
 * // In a client component
 * const maps = await GoogleMapsService.getMapsLibrary();
 * const map = new maps.Map(element, options);
 * 
 * const places = await GoogleMapsService.getPlacesLibrary();
 * const autocomplete = new places.Autocomplete(input, options);
 * 
 * const marker = await GoogleMapsService.getMarkerLibrary();
 * const advancedMarker = new marker.AdvancedMarkerElement({ ... });
 * ```
 */

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

class GoogleMapsServiceClass {
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  /**
   * Ensure Google Maps API is initialized
   * Sets options and prepares for library imports
   */
  private async ensureInitialized(): Promise<void> {
    // Check if running on server
    if (typeof window === "undefined") {
      throw new Error(
        "[GoogleMapsService] Google Maps can only be loaded in the browser"
      );
    }

    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Already initialized
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // Start initialization
    this.initPromise = (async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        throw new Error(
          "[GoogleMapsService] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing. " +
          "Please add it to your .env.local file."
        );
      }

      // Set options once for all library imports
      // Optimized for Belarus region with Russian language
      setOptions({
        key: apiKey,
        v: "weekly",
        language: "ru",
        region: "BY",
      });

      this.isInitialized = true;
    })();

    try {
      await this.initPromise;
    } catch (error) {
      // Reset on error to allow retry
      this.initPromise = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Get the Maps library
   * @returns Promise resolving to google.maps.MapsLibrary
   */
  async getMapsLibrary(): Promise<google.maps.MapsLibrary> {
    await this.ensureInitialized();
    return importLibrary("maps");
  }

  /**
   * Get the Places library
   * @returns Promise resolving to google.maps.PlacesLibrary
   */
  async getPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
    await this.ensureInitialized();
    return importLibrary("places");
  }

  /**
   * Get the Marker library (Advanced Markers)
   * @returns Promise resolving to google.maps.MarkerLibrary
   */
  async getMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
    await this.ensureInitialized();
    return importLibrary("marker");
  }

  /**
   * Get the Geocoding library
   * @returns Promise resolving to google.maps.GeocodingLibrary
   */
  async getGeocodingLibrary(): Promise<google.maps.GeocodingLibrary> {
    await this.ensureInitialized();
    return importLibrary("geocoding");
  }

  /**
   * Check if Google Maps is already initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const GoogleMapsService = new GoogleMapsServiceClass();
