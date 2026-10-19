import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanPersonFilter, planPersonFilterOptions } from "./PlanPersonFilter";

const options = planPersonFilterOptions([
  { value: "family", label: "Я" },
  { value: "child:1", label: "Степан" },
]);
assert.deepEqual(options.map((option) => option.label), ["Я", "Степан", "Для всех"]);
const markup = renderToStaticMarkup(
  <PlanPersonFilter options={options} value="all" onChange={() => {}} />,
);
assert.ok(markup.includes("Для кого:"));
assert.ok(markup.includes('aria-pressed="true"'));
assert.ok(markup.includes('aria-label="Для кого"'));
assert.equal((markup.match(/aria-pressed=/g) ?? []).length, 3);
console.log("PlanPersonFilter tests: OK");
