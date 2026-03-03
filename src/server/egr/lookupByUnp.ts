"use server";

// In-memory cache for UNP lookups (process lifetime)
const cache = new Map<string, { v: string | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export async function lookupLegalNameByUnp(
  unp: string
): Promise<{ legalName: string | null }> {
  // Clean and validate UNP
  const cleaned = unp.replace(/\D/g, "").trim();
  
  if (!/^\d{9}$/.test(cleaned)) {
    return { legalName: null };
  }

  // Check cache
  const cached = cache.get(cleaned);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { legalName: cached.v };
  }

  // Fetch from EGR API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const url = `http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/${cleaned}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { 
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`EGR API error: ${res.status}`);
      cache.set(cleaned, { v: null, ts: Date.now() });
      return { legalName: null };
    }

    const json = await res.json();

    // Map response fields - try multiple possible field names
    // EGR API may return: nameFull, nameShort, fullName, shortName, name, vNaimUl, etc.
    const legalName =
      json?.vNaimUl ?? // Common field in EGR responses
      json?.nameFull ??
      json?.nameShort ??
      json?.fullName ??
      json?.shortName ??
      json?.name ??
      null;

    const cleanedName =
      typeof legalName === "string" && legalName.trim()
        ? legalName.trim()
        : null;

    // Cache the result
    cache.set(cleaned, { v: cleanedName, ts: Date.now() });

    return { legalName: cleanedName };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("EGR lookup timeout");
    } else {
      console.error("EGR lookup error:", error);
    }
    
    // Cache null result to avoid repeated failed requests
    cache.set(cleaned, { v: null, ts: Date.now() });
    return { legalName: null };
  } finally {
    clearTimeout(timeoutId);
  }
}
