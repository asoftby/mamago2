import { listParserKeys } from "@/server/modules/import/parsers/registry";
import { PLACE_FIXTURES, EVENT_FIXTURES } from "@/server/modules/import/parsers/fixture-scenarios";
import { ParserDebugClient } from "./_components/ParserDebugClient";

export const dynamic = "force-dynamic";

export default function ParserDebugPage() {
  const parserKeys = listParserKeys();

  const fixtures = {
    ...Object.fromEntries(
      Object.entries(PLACE_FIXTURES).map(([k, v]) => [k, v.rawPayload])
    ),
    ...Object.fromEntries(
      Object.entries(EVENT_FIXTURES).map(([k, v]) => [k, v.rawPayload])
    ),
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Parser Debug</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dev-инструмент для проверки парсинга и нормализации без записи в БД.
        </p>
      </div>
      <ParserDebugClient parserKeys={parserKeys} fixtures={fixtures} />
    </div>
  );
}
