/** Регион как отдельный фрагмент после запятой (кириллица не попадает под `\b` в JS). */
function shouldDropRegionPart(p: string): boolean {
  const t = p.trim();
  if (!t) return false;
  if (/^.+\sобласть(\s+\d{5,6})?\s*$/i.test(t)) return true;
  if (/^.+\sвобласць(\s+\d{5,6})?\s*$/i.test(t)) return true;
  if (/^.+\sкрай(\s+\d{5,6})?\s*$/i.test(t)) return true;
  return false;
}

function streetScore(s: string): number {
  let n = 0;
  if (/\d/.test(s)) n += 2;
  if (
    /(ул\.?|просп|пр\.|увул\.|бульв\.|пер\.|наб\.|шоссе|пл\.|линия|тупик|микрорайон|м-н)/i.test(
      s,
    )
  ) {
    n += 3;
  }
  return n;
}

/** Две части: сначала город, затем улица с домом (по streetScore). */
function reorderCityThenStreet(parts: string[]): string[] {
  if (parts.length !== 2) return parts;
  const [a, b] = parts;
  const sa = streetScore(a);
  const sb = streetScore(b);
  if (sa > sb) return [b, a];
  if (sb > sa) return [a, b];
  return parts;
}

function insertSpaceAfterDotAbbrev(s: string): string {
  return s
    .replace(/(пр\.)([А-Яа-яЁё])/gi, "$1 $2")
    .replace(/(ул\.)([А-Яа-яЁё])/gi, "$1 $2")
    .replace(/(г\.)([А-Яа-яЁё])/gi, "$1 $2");
}

const STREET_HINT =
  /(ул\.?|просп|пр\.|увул\.|бульв\.|пер\.|наб\.|шоссе|пл\.|линия|тупик|микрорайон|м-н)/i;

/** «пр. Независимости 50» → «пр. Независимости, 50» (только если похоже на строку улицы). */
function commaBeforeTrailingHouseNumber(segment: string): string {
  const t = segment.trim();
  if (!STREET_HINT.test(t)) return t;
  if (/,\s*\d/.test(t)) return t;
  const m = t.match(/^(.+?)\s+(\d{1,4})([а-яА-ЯёЁa-zA-Z]?)$/);
  if (!m) return t;
  return `${m[1]!.trim()}, ${m[2]}${m[3] ?? ""}`;
}

function addCommaBeforeHouseInLastSegment(s: string): string {
  const segs = s.split(", ").map((x) => x.trim()).filter(Boolean);
  if (segs.length === 0) return s;
  segs[segs.length - 1] = commaBeforeTrailingHouseNumber(segs[segs.length - 1]!);
  return segs.join(", ");
}

/**
 * Показ: город и улица с домом; без области/края/вобласці и индекса.
 * Порядок: «Минск, пр. Независимости, 50» (город первым; запятая перед номером дома).
 */
export function formatVenueAddressForPublicDisplay(
  raw: string | undefined | null,
): string {
  if (raw == null || raw.trim() === "") return "";
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const kept: string[] = [];

  for (const p of parts) {
    if (shouldDropRegionPart(p)) continue;
    if (/^\d{5,6}$/.test(p)) continue;
    const zipTail = /\s\d{5,6}$/;
    if (zipTail.test(p)) {
      const z = p.replace(zipTail, "").trim();
      if (z.length > 0) kept.push(z);
      continue;
    }
    kept.push(p);
  }

  const reordered = reorderCityThenStreet(kept);
  const out = addCommaBeforeHouseInLastSegment(
    insertSpaceAfterDotAbbrev(reordered.join(", ").trim()),
  );
  return out.length > 0 ? out : raw.trim();
}
