import assert from "node:assert/strict";

import { toggleAgeRangeSelection } from "./ageRangeSelection";

{
  // 1 диапазон: выбор из пустого набора.
  const result = toggleAgeRangeSelection([], "1-3");
  assert.deepEqual(result, ["1-3"]);
  console.log("single range: select from empty — OK");
}

{
  // 3 диапазона: последовательный набор до лимита.
  let selected: string[] = [];
  selected = toggleAgeRangeSelection(selected, "0-1");
  selected = toggleAgeRangeSelection(selected, "1-3");
  selected = toggleAgeRangeSelection(selected, "3-5");
  assert.deepEqual(selected, ["0-1", "1-3", "3-5"]);
  console.log("three ranges: fills up to the cap — OK");
}

{
  // Вытеснение четвёртого: FIFO, самый старый выбор уходит, не блокируется молча.
  let selected: string[] = ["0-1", "1-3", "3-5"];
  selected = toggleAgeRangeSelection(selected, "5-7");
  assert.deepEqual(selected, ["1-3", "3-5", "5-7"]);
  assert.equal(selected.length, 3);
  console.log("fourth pick evicts the oldest (FIFO), cap stays at 3 — OK");
}

{
  // Повторный клик по уже выбранному диапазону — снимает выбор (toggle off).
  const selected = toggleAgeRangeSelection(["1-3", "3-5"], "1-3");
  assert.deepEqual(selected, ["3-5"]);
  console.log("re-clicking a selected range deselects it — OK");
}

console.log("\nageRangeSelection tests: all OK");
