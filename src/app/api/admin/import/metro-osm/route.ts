import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

// Prisma -> только node runtime
export const runtime = "nodejs";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

function buildQueryFromCenter(lat: number, lng: number, radiusMeters: number) {
  return `
[out:json][timeout:25];
(
  node["railway"="station"]["station"="subway"](around:${radiusMeters},${lat},${lng});
  way["railway"="station"]["station"="subway"](around:${radiusMeters},${lat},${lng});
  relation["railway"="station"]["station"="subway"](around:${radiusMeters},${lat},${lng});
);
out center;
`.trim();
}

function buildQuery(cityName: string) {
  // IMPORTANT: cityName must match OSM admin area name.
  // For Minsk usually "Минск" works, but if not — try "Minsk".
  return `
[out:json][timeout:25];
area["name"="${cityName}"]["boundary"="administrative"]->.a;
(
  node["railway"="station"]["station"="subway"](area.a);
  way["railway"="station"]["station"="subway"](area.a);
  relation["railway"="station"]["station"="subway"](area.a);
);
out center;
`.trim();
}

async function fetchOverpass(query: string) {
  const body = new URLSearchParams({ data: query }).toString();

  let lastErr: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          // Overpass любит User-Agent. Контакт можешь заменить на свой.
          "user-agent": "mamago-admin-import/1.0 (contact: admin@mamago.by)",
        },
        body,
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Частые кейсы: 429, 504
        lastErr = new Error(`Overpass ${res.status} at ${endpoint}: ${text.slice(0, 300)}`);
        continue;
      }

      return await res.json();
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  throw lastErr ?? new Error("Overpass request failed");
}

export async function POST(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { cityId, radiusMeters } = (await req.json()) as { cityId?: string; radiusMeters?: number };
    if (!cityId) {
      return NextResponse.json({ message: "cityId is required" }, { status: 400 });
    }

    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      return NextResponse.json({ message: "City not found" }, { status: 404 });
    }

    type OverpassResponse = {
      elements?: Array<{
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    let data: OverpassResponse | null = null;
    let usedMethod: string | null = null;

    // 1. Try "around" query if city has coordinates
    if (city.lat && city.lng) {
      const radius = Math.min(Math.max(radiusMeters ?? 25000, 5000), 80000);
      const query = buildQueryFromCenter(city.lat, city.lng, radius);
      const json = await fetchOverpass(query) as OverpassResponse;
      
      const elements = Array.isArray(json?.elements) ? json.elements : [];
      if (elements.length > 0) {
        data = json;
        usedMethod = `around:${radius}m`;
      }
    } else {
       // If no coordinates, we could return 400 as requested, 
       // OR proceed to fallback. The task says:
       // "если lat/lng null -> 400: 'City center coordinates required for OSM import. Set City.lat/lng first.'"
       return NextResponse.json({ 
         message: "City center coordinates (lat/lng) required for OSM import. Please set City.lat/lng in DB first." 
       }, { status: 400 });
    }

    // 2. Fallback to area name if "around" failed (or returned 0 results)
    if (!data) {
       // Пытаемся сначала по локальному имени, потом по английскому (если задан slug)
      const tryNames = [
        city.name,
        city.slug ? city.slug[0].toUpperCase() + city.slug.slice(1) : null, // "minsk" -> "Minsk"
        city.slug?.toLowerCase() === "minsk" ? "Minsk" : null,
      ].filter(Boolean) as string[];

      for (const name of tryNames) {
        const query = buildQuery(name);
        const json = await fetchOverpass(query) as OverpassResponse;

        const elements = Array.isArray(json?.elements) ? json.elements : [];
        if (elements.length > 0) {
          data = json;
          usedMethod = `area:${name}`;
          break;
        }
      }
    }

    if (!data) {
      return NextResponse.json(
        {
          message:
            "No subway stations found. Tried search by coordinates (radius) and by area name. Ensure City has correct lat/lng or OSM name matches.",
        },
        { status: 422 }
      );
    }

    const elements = data.elements ?? [];

    const MINSK_BE_TO_RU: Record<string, string> = {
      "Каменнагорская": "Каменная Горка",
      "Кунцаўшчына": "Кунцевщина",
      "Спартыўная": "Спортивная",
      "Пушкінская": "Пушкинская",
      "Маладзёжная": "Молодёжная",
      "Фрунзенская": "Фрунзенская",
      "Няміга": "Немига",
      "Купалаўская": "Купаловская",
      "Кастрычніцкая": "Октябрьская",
      "Плошча Леніна": "Площадь Ленина",
      "Інстытут культуры": "Институт культуры",
      "Грушаўка": "Грушевка",
      "Міхалова": "Михалово",
      "Пятроўшчына": "Петровщина",
      "Малінаўка": "Малиновка",
      "Уручча": "Уручье",
      "Барысаўскі тракт": "Борисовский тракт",
      "Усход": "Восток",
      "Маскоўская": "Московская",
      "Парк Чалюскінцаў": "Парк Челюскинцев",
      "Акадэмія навук": "Академия наук",
      "Плошча Якуба Коласа": "Площадь Якуба Коласа",
      "Плошча Перамогі": "Площадь Победы",
      "Пралетарская": "Пролетарская",
      "Трактарны завод": "Тракторный завод",
      "Партызанская": "Партизанская",
      "Аўтазаводская": "Автозаводская",
      "Магілёўская": "Могилёвская",
    };

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const el of elements) {
      const tags = el.tags || {};
      let name =
        tags["name:ru"] ||
        tags["name:en"] ||
        tags["name"] ||
        tags["name:be"] ||
        "";

      name = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

      if (city.slug === "minsk" && MINSK_BE_TO_RU[name]) {
        name = MINSK_BE_TO_RU[name];
      }

      if (!name) {
        skipped++;
        continue;
      }

      const osmType = String(el.type);
      const osmId = String(el.id);

      let lat: number | null = null;
      let lng: number | null = null;

      if (osmType === "node") {
        lat = typeof el.lat === "number" ? el.lat : null;
        lng = typeof el.lon === "number" ? el.lon : null;
      } else {
        lat = typeof el?.center?.lat === "number" ? el.center.lat : null;
        lng = typeof el?.center?.lon === "number" ? el.center.lon : null;
      }

      if (lat == null || lng == null) {
        skipped++;
        continue;
      }

      // upsert by (cityId, osmType, osmId)
      const existing = await prisma.metroStation.findFirst({
        where: { cityId: city.id, osmType, osmId },
        select: { id: true },
      });

      if (existing) {
        try {
          await prisma.metroStation.update({
            where: { id: existing.id },
            data: { name, lat, lng, source: "OSM" },
          });
          updated++;
        } catch (error: unknown) {
          // Если ошибка уникальности имени (P2002), обновляем только координаты
          if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
            await prisma.metroStation.update({
              where: { id: existing.id },
              data: { lat, lng, source: "OSM" },
            });
            updated++;
          } else {
            console.error(`Failed to update station ${name} (${osmId}):`, error);
            skipped++;
          }
        }
      } else {
        try {
          await prisma.metroStation.create({
            data: {
              cityId: city.id,
              name,
              lat,
              lng,
              osmType,
              osmId,
              source: "OSM",
            },
          });
          imported++;
        } catch (error: unknown) {
          // Если ошибка уникальности имени (P2002), пробуем добавить суффикс
          if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
             try {
                await prisma.metroStation.create({
                  data: {
                    cityId: city.id,
                    name: `${name} (OSM)`,
                    lat,
                    lng,
                    osmType,
                    osmId,
                    source: "OSM",
                  },
                });
                imported++;
             } catch (retryError) {
                console.error(`Failed to create station ${name} (${osmId}) with suffix:`, retryError);
                skipped++;
             }
          } else {
            console.error(`Failed to create station ${name} (${osmId}):`, error);
            skipped++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      cityId: city.id,
      usedMethod,
      imported,
      updated,
      skipped,
      total: elements.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Import failed";
    // Часто тут будет Overpass 429/504 или network error
    return NextResponse.json({ ok: false, message: msg }, { status: 503 });
  }
}