import assert from "node:assert/strict";
import { parseEventImportLocationHint } from "./eventImportLocationHint";

{
  const hint = parseEventImportLocationHint({
    entityType: "EVENT",
    placeName: "Парк Горького",
    placeAddress: "ул. Фрунзе, 2",
    city: "Минск",
    description:
      "Большое описание события, которое не должно попадать в блок локации даже если оно есть в payload.",
  });

  assert.deepEqual(hint, {
    venueName: "Парк Горького",
    addressText: "ул. Фрунзе, 2",
    cityName: "Минск",
  });
}

{
  const hint = parseEventImportLocationHint({
    placeName: "Центральный ботанический сад",
    placeAddress: "ул. Сурганова, 2а",
    city: "Минск",
    body:
      "Полное описание события из raw payload, которое не должно отображаться в location step.",
  });

  assert.deepEqual(hint, {
    venueName: "Центральный ботанический сад",
    addressText: "ул. Сурганова, 2а",
    cityName: "Минск",
  });
}

{
  const hint = parseEventImportLocationHint({
    venue: "Центральный ботанический сад",
    address: "ул. Сурганова, 2а",
    town: "Минск",
    text:
      "Описание события остаётся в payload, но не должно использоваться как адрес на шаге локации.",
  });

  assert.deepEqual(hint, {
    venueName: "Центральный ботанический сад",
    addressText: "ул. Сурганова, 2а",
    cityName: "Минск",
  });
}

{
  const hint = parseEventImportLocationHint({
    placeName: "Центральный ботанический сад",
    city: "Минск",
    sourceText:
      "Центральный ботанический сад, ул. Сурганова, 2а. Полное описание события остаётся в payload, но не должно рендериться в location step.",
  });

  assert.deepEqual(hint, {
    venueName: "Центральный ботанический сад",
    addressText: "ул. Сурганова, 2а",
    cityName: "Минск",
  });
}

{
  const hint = parseEventImportLocationHint({
    venueName: "Центральный ботанический сад",
    addressText:
      "ул. Сурганова, 2а Организаторы проекта «Букидс» объявили даты нового фестиваля и опубликовали программу",
    cityName: "Минск",
  });

  assert.deepEqual(hint, {
    venueName: "Центральный ботанический сад",
    addressText: "ул. Сурганова, 2а",
    cityName: "Минск",
  });
}

{
  const hint = parseEventImportLocationHint({
    entityType: "EVENT",
    venueName:
      "Это слишком длинный текст, который на самом деле похож на описание события и не должен попадать в блок выбора места на шаге локации редактора",
    cityName: "Минск",
  });

  assert.deepEqual(hint, {
    cityName: "Минск",
  });
}

console.log("eventImportLocationHint tests: OK");
