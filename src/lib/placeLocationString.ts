/**
 * Place Location String Utilities
 * Formats location information for display on public pages
 */

function removeCityFromAddress(address: string, cityName: string): string {
  // Remove ", CityName" or " CityName" from the end
  const patterns = [
    new RegExp(`,\\s*${cityName}\\s*$`, 'i'),
    new RegExp(`\\s+${cityName}\\s*$`, 'i'),
  ];
  
  let cleaned = address;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned.trim();
}

/**
 * Format district name with "район" suffix if not already present
 * Example: "Московский" → "Московский район"
 * Example: "Московский район" → "Московский район" (no duplication)
 */
function formatDistrictLabel(districtName: string): string {
  const trimmed = districtName.trim();
  
  // Check if already ends with "район"
  if (trimmed.toLowerCase().endsWith('район')) {
    return trimmed;
  }
  
  return `${trimmed} район`;
}

/**
 * Add "ул." prefix to street address if not already present
 * Example: "Восточная 137" → "ул.Восточная 137"
 * Example: "ул. Восточная 137" → "ул.Восточная 137" (normalized)
 */
function addStreetPrefix(address: string): string {
  const trimmed = address.trim();
  
  // Check if already starts with "ул." or "ул "
  if (trimmed.toLowerCase().startsWith('ул.') || trimmed.toLowerCase().startsWith('ул ')) {
    // Normalize: remove space after "ул." if present
    return trimmed.replace(/^ул\.?\s*/i, 'ул.');
  }
  
  return `ул.${trimmed}`;
}

/**
 * Build location string for place hero section
 * Format: "Минск, ул.Восточная 137 · Московский район · м.Уручье"
 * 
 * Parts (joined with " · "):
 * 1. City + Address: "Минск, ул.Восточная 137" (city duplication removed, "ул." prefix added)
 * 2. District: "Московский район" (with "район" suffix)
 * 3. Metro: "м.Восток" (with "м." prefix, no space)
 * 
 * @param place - Place data with location info
 * @returns Formatted location string
 */
export function getPlaceLocationString(place: {
  city?: { name: string } | null;
  shortAddress?: string | null;
  districtAuto?: { name: string } | null;
  districtManual?: { name: string } | null;
  metroAuto?: { name: string } | null;
  metroManual?: { name: string } | null;
}): string {
  const parts: string[] = [];

  // Part 1: City + Address (remove city duplication, add "ул." prefix)
  if (place.city?.name) {
    if (place.shortAddress) {
      const cleanAddress = removeCityFromAddress(place.shortAddress, place.city.name);
      const addressWithPrefix = addStreetPrefix(cleanAddress);
      parts.push(`${place.city.name}, ${addressWithPrefix}`);
    } else {
      parts.push(place.city.name);
    }
  } else if (place.shortAddress) {
    const addressWithPrefix = addStreetPrefix(place.shortAddress);
    parts.push(addressWithPrefix);
  }

  // Part 2: District (prefer manual over auto, add "район" suffix)
  const district = place.districtManual || place.districtAuto;
  if (district?.name) {
    parts.push(formatDistrictLabel(district.name));
  }

  // Part 3: Metro (prefer manual over auto, add "м." prefix without space)
  const metro = place.metroManual || place.metroAuto;
  if (metro?.name) {
    parts.push(`м.${metro.name}`);
  }

  return parts.join(" · ");
}

function formatInteriorPart(args: {
  floor: string | null | undefined;
  unit: string | null | undefined;
  unitLabel: string | null | undefined;
}): string | null {
  const label = args.unitLabel?.trim();
  if (label) return label;
  const floor = args.floor?.trim();
  const unit = args.unit?.trim();
  const bits: string[] = [];
  if (floor) bits.push(`эт. ${floor}`);
  if (unit) bits.push(unit.includes(" ") || /^(кв|оф|пав)\.?/i.test(unit) ? unit : `кв. ${unit}`);
  if (!bits.length) return null;
  return bits.join(", ");
}

/** В строке улицы нет цифр — вероятно нет дома/корпуса/квартиры в shortAddress. */
function lineLooksMissingHouseNumber(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && !/\d/.test(t);
}

function hasExplicitStreetPrefix(s: string): boolean {
  return /^(ул\.?|просп\.?|пр-т|бул\.?|пер\.?|ш\.|шоссе|пл\.?|наб\.?|микрорайон|м-н)\s*/i.test(
    s.trim(),
  );
}

function normalizeUlPrefixInLine(s: string): string {
  const t = s.trim();
  if (/^ул\.?\s+/i.test(t)) return t.replace(/^ул\.?\s*/i, "ул.");
  return t;
}

/**
 * Первая часть полного адреса с цифрой (улица, дом, квартира/корпус в одном фрагменте до «, город/область»).
 */
function firstFormattedStreetSegment(
  formattedAddr: string,
  cityName: string,
): string | null {
  let s = formattedAddr.trim();
  if (!s) return null;
  if (cityName) {
    s = removeCityFromAddress(s, cityName);
  }
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (/\d/.test(parts[0])) return parts[0];
  if (parts.length >= 2 && /\d/.test(parts[1])) {
    return `${parts[0]}, ${parts[1]}`.trim();
  }
  return /\d/.test(s) ? s : null;
}

/** Убирает «… область», индекс и лишние запятые из хвоста адресной строки. */
function stripRegionAndPostalFromAddressTail(s: string): string {
  return s
    .replace(/,?\s*[А-Яа-яЁё]+\s+область/gi, "")
    .replace(/,?\s*\b\d{5,6}\b/g, "")
    .replace(/,+|\s+,/g, ",")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
}

/** После «ул.» добавляет пробел, если его нет. */
function humanizeLeadingStreetAbbrev(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/^ул\./i.test(t) && !/^ул\.\s/i.test(t)) {
    return t.replace(/^ул\./i, "ул. ");
  }
  return t;
}

function resolvePlaceStreetAndInterior(place: {
  city?: { name: string } | null;
  shortAddress?: string | null;
  formattedAddr?: string | null;
  customAddress?: string | null;
  floor?: string | null;
  unit?: string | null;
  unitLabel?: string | null;
}): { cityName: string; streetPart: string; interior: string | null } {
  const cityName = place.city?.name?.trim() || "";

  let streetRaw = "";
  let fromShortAddress = false;
  if (place.shortAddress?.trim()) {
    streetRaw = place.shortAddress.trim();
    fromShortAddress = true;
  } else if (place.customAddress?.trim()) {
    streetRaw = place.customAddress.trim();
  } else if (place.formattedAddr?.trim()) {
    streetRaw = place.formattedAddr.trim();
  }

  if (streetRaw && cityName) {
    streetRaw = removeCityFromAddress(streetRaw, cityName);
  }

  let streetPart = streetRaw
    ? fromShortAddress
      ? addStreetPrefix(streetRaw)
      : streetRaw
    : "";

  if (
    fromShortAddress &&
    streetPart &&
    lineLooksMissingHouseNumber(streetPart) &&
    place.formattedAddr?.trim()
  ) {
    const fromFormatted = firstFormattedStreetSegment(place.formattedAddr, cityName);
    if (fromFormatted && /\d/.test(fromFormatted)) {
      const seg = fromFormatted.trim();
      streetPart = hasExplicitStreetPrefix(seg)
        ? normalizeUlPrefixInLine(seg)
        : addStreetPrefix(seg.replace(/^ул\.?\s*/i, "").trim());
    }
  }

  const interior = formatInteriorPart({
    floor: place.floor,
    unit: place.unit,
    unitLabel: place.unitLabel,
  });

  streetPart = stripRegionAndPostalFromAddressTail(streetPart);

  return { cityName, streetPart: streetPart.trim(), interior };
}

/**
 * Однострочный адрес для marketplace hero:
 * «г. Минск, ул. Нёманская, 43-144» (+ этаж/квартира при наличии).
 */
export function formatMarketplaceHeroAddress(place: {
  city?: { name: string } | null;
  shortAddress?: string | null;
  formattedAddr?: string | null;
  customAddress?: string | null;
  floor?: string | null;
  unit?: string | null;
  unitLabel?: string | null;
}): string {
  const { cityName, streetPart: sp, interior } = resolvePlaceStreetAndInterior(place);

  if (!sp && !cityName) {
    return interior ?? "";
  }

  if (!cityName) {
    const hm = sp?.match(/^(.+?)\s+(\d[\d\-\/]*)$/);
    if (hm && sp) {
      const st = humanizeLeadingStreetAbbrev(hasExplicitStreetPrefix(hm[1]) ? hm[1] : addStreetPrefix(hm[1]));
      const line = `${st.trim()}, ${hm[2]}`;
      return interior ? `${line}, ${interior}` : line;
    }
    const lineNoCity = humanizeLeadingStreetAbbrev(sp || "").trim();
    return [lineNoCity, interior].filter(Boolean).join(", ");
  }

  if (!sp) {
    return interior ? `г. ${cityName}, ${interior}` : `г. ${cityName}`;
  }

  const houseMatch = sp.match(/^(.+?)\s+(\d[\d\-\/]*)$/);
  let core: string;
  if (houseMatch) {
    let streetLabel = houseMatch[1].trim();
    if (!hasExplicitStreetPrefix(streetLabel)) {
      streetLabel = addStreetPrefix(streetLabel.replace(/^ул\.?\s*/i, "").trim());
    } else {
      streetLabel = normalizeUlPrefixInLine(streetLabel);
    }
    streetLabel = humanizeLeadingStreetAbbrev(streetLabel).trim();
    core = `г. ${cityName}, ${streetLabel}, ${houseMatch[2]}`;
  } else {
    const line = humanizeLeadingStreetAbbrev(
      hasExplicitStreetPrefix(sp) ? normalizeUlPrefixInLine(sp) : addStreetPrefix(sp.replace(/^ул\.?\s*/i, "").trim()),
    ).trim();
    core = `г. ${cityName}, ${line}`;
  }
  return interior ? `${core}, ${interior}` : core;
}

/**
 * Однострочный адрес для поисковой карточки места (как на marketplace hero):
 * «г. Минск, ул. Нёманская, 43-144» и при необходимости этаж/квартира.
 */
export function getPlaceSearchAddressMetaLine(place: {
  city?: { name: string } | null;
  shortAddress?: string | null;
  formattedAddr?: string | null;
  customAddress?: string | null;
  floor?: string | null;
  unit?: string | null;
  unitLabel?: string | null;
}): string {
  const line = formatMarketplaceHeroAddress(place);
  return line.trim() || "Место";
}
