import assert from "node:assert/strict";

import { slugifyLabelToValue } from "./slugifyLabelToValue";

function expect(input: string, expected: string) {
  assert.equal(
    slugifyLabelToValue(input),
    expected,
    `slugifyLabelToValue(${JSON.stringify(input)})`,
  );
}

// Кириллица
expect("  Спорт  ", "sport");
expect("Активные игры", "aktivnye-igry");
expect("Спокойный отдых", "spokoinyi-otdykh");
expect("Животные", "zhivotnye");
expect("Творчество", "tvorchestvo");
expect("Для малышей", "dlya-malyshei");

// Разделители/спецсимволы
expect("Наука / Техника", "nauka-tekhnika");
expect("Kids & Fun", "kids-fun");
expect("!!!", "");
expect("Тест---123", "test-123");

// Edge cases
expect("", "");
expect("   ", "");
expect("   +--/   ", "");

 
console.log("slugifyLabelToValue tests: OK");

