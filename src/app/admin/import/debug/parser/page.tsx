import { listParserKeys } from "@/server/modules/import/parsers/registry";
import { ParserDebugClient } from "./_components/ParserDebugClient";

export const dynamic = "force-dynamic";

export default function ParserDebugPage() {
  const parserKeys = listParserKeys();
  const rawSamples: Record<string, unknown> = {};

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Parser Debug</h1>
        <p className="mt-1 text-sm text-gray-500">
          Инструмент для проверки парсинга и нормализации без записи в БД. Вставьте реальный raw payload.
        </p>
      </div>
      <ParserDebugClient parserKeys={parserKeys} rawSamples={rawSamples} />
    </div>
  );
}
