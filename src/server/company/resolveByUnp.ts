/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

export type ResolveResult = {
  legalName: string | null;
  source: "EGR" | "GRP" | null;
};

// In-memory cache for UNP lookups (process lifetime)
const cache = new Map<string, { name: string | null; source: "EGR" | "GRP" | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function resolveCompanyByUnp(unp: string): Promise<ResolveResult> {
  // Clean and validate UNP
  const cleaned = unp.replace(/\D/g, "").trim();
  
  if (!/^\d{9}$/.test(cleaned)) {
    return { 
      legalName: null, 
      source: null,
    };
  }

  // Check cache
  const cached = cache.get(cleaned);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { legalName: cached.name, source: cached.source };
  }

  // Try EGR first (primary source)
  const egrResult = await tryEgrLookup(cleaned);
  if (egrResult.legalName) {
    cache.set(cleaned, { name: egrResult.legalName, source: "EGR", ts: Date.now() });
    console.log(`[UNP Resolver] ${cleaned} -> EGR: ${egrResult.legalName}`);
    return { legalName: egrResult.legalName, source: "EGR" };
  }

  // Fallback to GRP
  const grpResult = await tryGrpLookup(cleaned);
  if (grpResult.legalName) {
    cache.set(cleaned, { name: grpResult.legalName, source: "GRP", ts: Date.now() });
    console.log(`[UNP Resolver] ${cleaned} -> GRP: ${grpResult.legalName}`);
    return { legalName: grpResult.legalName, source: "GRP" };
  }

  // Both failed
  cache.set(cleaned, { name: null, source: null, ts: Date.now() });
  console.log(`[UNP Resolver] ${cleaned} -> Not found`);
  return { legalName: null, source: null };
}

async function tryEgrLookup(unp: string): Promise<{ legalName: string | null }> {
  const maxRetries = 1;
  
  // Try HTTPS first, then HTTP fallback
  const urls = [
    `https://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/${unp}`,
    `http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/${unp}`,
  ];
  
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    const url = urls[urlIndex];
    const protocol = url.startsWith('https') ? 'HTTPS' : 'HTTP';
    
    if (urlIndex > 0) {
      console.warn(`[UNP] Fallback -> EGR ${protocol}`);
    }
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort("Request timeout"), 15000); // 15 second timeout

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
          const text = await res.text().catch(() => "");
          console.warn(`[UNP][EGR ${protocol}]`, { 
            unp, 
            url, 
            status: res.status, 
            statusText: res.statusText,
            body: text.slice(0, 300) 
          });
          
          if (attempt < maxRetries) {
            await sleep(300);
            continue;
          }
          // Try next URL (HTTP fallback)
          break;
        }

        const text = await res.text();
        let json;
        
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          console.error(`[UNP][EGR ${protocol}] JSON parse error for ${unp}:`, parseError);
          console.warn(`[UNP][EGR ${protocol}] Response preview:`, text.slice(0, 300));
          if (attempt < maxRetries) {
            await sleep(300);
            continue;
          }
          break;
        }

        // Log available keys for debugging
        if (json && typeof json === "object") {
          console.log(`[UNP][EGR ${protocol}] Response keys for ${unp}:`, Object.keys(json));
        }

        // Try multiple field names in priority order
        const legalName = 
          pickFirstNonEmpty([
            json?.nameFull,
            json?.fullName,
            json?.nameShort,
            json?.shortName,
            json?.name,
            json?.VNAIMP,
            json?.VNAIMK,
            json?.vNaimUl,
            json?.vunp, // Sometimes lowercase
            json?.naimk,
            json?.naimp,
          ]);

        if (legalName) {
          console.log(`[UNP][EGR ${protocol}] ✓ Found for ${unp}: ${legalName}`);
          return { legalName };
        }

        // No name found in this response, try next URL
        console.warn(`[UNP][EGR ${protocol}] No name field found for ${unp} in response`);
        break;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.error(`[UNP][EGR ${protocol}] Timeout for ${unp} at ${url} (attempt ${attempt + 1})`);
        } else {
          console.error(`[UNP][EGR ${protocol}] Error for ${unp} at ${url}:`, error);
        }
        
        if (attempt < maxRetries) {
          await sleep(300);
          continue;
        }
        
        // Try next URL
        break;
      }
    }
  }
  
  return { legalName: null };
}

async function tryGrpLookup(unp: string): Promise<{ legalName: string | null }> {
  const maxRetries = 1;
  
  // Try HTTPS first, then HTTP fallback
  const urls = [
    `https://grp.nalog.gov.by/api/grp-public/data?unp=${unp}&charset=UTF-8&type=json`,
    `http://grp.nalog.gov.by/api/grp-public/data?unp=${unp}&charset=UTF-8&type=json`,
  ];
  
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    const url = urls[urlIndex];
    const protocol = url.startsWith('https') ? 'HTTPS' : 'HTTP';
    
    if (urlIndex === 0) {
      console.warn(`[UNP] Fallback -> GRP ${protocol}`);
    } else {
      console.warn(`[UNP] Fallback -> GRP ${protocol}`);
    }
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort("Request timeout"), 15000); // 15 second timeout

        const res = await fetch(url, {
          method: "GET",
          headers: { 
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn(`[UNP][GRP ${protocol}]`, { 
            unp, 
            url, 
            status: res.status, 
            statusText: res.statusText,
            body: text.slice(0, 300) 
          });
          
          if (attempt < maxRetries) {
            await sleep(300);
            continue;
          }
          // Try next URL (HTTP fallback)
          break;
        }

        const text = await res.text();
        let json;
        
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          console.error(`[UNP][GRP ${protocol}] JSON parse error for ${unp}:`, parseError);
          console.warn(`[UNP][GRP ${protocol}] Response preview:`, text.slice(0, 300));
          if (attempt < maxRetries) {
            await sleep(300);
            continue;
          }
          break;
        }

        // Log available keys for debugging
        if (json && typeof json === "object") {
          console.log(`[UNP][GRP ${protocol}] Response keys for ${unp}:`, Object.keys(json));
        }

        // GRP returns multiple formats:
        // 1. { row: {...} } - single object
        // 2. { row: [...] } - array
        // 3. { data: [...] } - array in data property
        // 4. [...] - direct array
        let item = null;
        
        if (json?.row) {
          // Check if row is an object (not array)
          if (typeof json.row === 'object' && !Array.isArray(json.row)) {
            item = json.row;
          } else if (Array.isArray(json.row) && json.row.length > 0) {
            item = json.row[0];
          }
        } else if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          item = json.data[0];
        } else if (Array.isArray(json) && json.length > 0) {
          item = json[0];
        }

        if (!item) {
          console.warn(`[UNP][GRP ${protocol}] No data found for ${unp}`);
          break;
        }

        // Log item keys for debugging
        if (item && typeof item === "object") {
          console.log(`[UNP][GRP ${protocol}] Item keys for ${unp}:`, Object.keys(item));
        }

        // Try multiple field names in priority order (both cases)
        const legalName = pickFirstNonEmpty([
          item?.VNAIMP,
          item?.vnaimp,
          item?.vNaimP,
          item?.VNAIMK,
          item?.vnaimk,
          item?.vNaimK,
          item?.nameFull,
          item?.nameShort,
          item?.name,
          item?.vunp,
        ]);

        if (legalName) {
          console.log(`[UNP][GRP ${protocol}] ✓ Found for ${unp}: ${legalName}`);
          return { legalName };
        }

        console.warn(`[UNP][GRP ${protocol}] No name field found for ${unp} in item`);
        break;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.error(`[UNP][GRP ${protocol}] Timeout for ${unp} (attempt ${attempt + 1})`);
        } else {
          console.error(`[UNP][GRP ${protocol}] Error for ${unp}:`, error);
        }
        
        if (attempt < maxRetries) {
          await sleep(300);
          continue;
        }
        
        // Try next URL
        break;
      }
    }
  }
  
  return { legalName: null };
}

// Helper: pick first non-empty string from array
function pickFirstNonEmpty(values: unknown[]): string | null {
  for (const val of values) {
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

// Helper: sleep for retry delay
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
