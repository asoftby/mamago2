import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";

/**
 * Заголовок с выделением «в Минске»: курсив основным цветом (как «и статьи» в «Обзоры и статьи»).
 * Если фразы города в заголовке нет — выводит текст как есть.
 */
export function CityTitle({ title, citySlug }: { title: string; citySlug: string }) {
  const phrase = getCityLocativePhrase(citySlug);
  const index = title.indexOf(phrase);
  if (index < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, index)}
      <span className="italic text-primary">{phrase}</span>
      {title.slice(index + phrase.length)}
    </>
  );
}
