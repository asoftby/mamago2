import assert from "node:assert/strict";
import { decideMigratedMediaMetadataPatch } from "./decideMigratedMediaMetadataPatch";

{
  const d = decideMigratedMediaMetadataPatch({
    current: { title: "IMG_4888", alt: null, caption: null },
    generated: {
      title: "Малберри Клаб (Mulberry Club), Минск",
      alt: "Фотография места Малберри Клаб (Mulberry Club), Минск",
      caption: "Фотогалерея места Малберри Клаб (Mulberry Club), Минск",
    },
  });
  assert.equal(d.action, "APPLY");
  if (d.action === "APPLY") {
    assert.equal(d.next.title, "Малберри Клаб (Mulberry Club), Минск");
    assert.ok(d.next.alt?.includes("Малберри"));
    assert.deepEqual(d.changed.sort(), ["alt", "caption", "title"]);
  }
}

{
  const d = decideMigratedMediaMetadataPatch({
    current: { title: "Клуб английского языка Малберри Клаб 02", alt: null, caption: null },
    generated: {
      title: "Малберри Клаб (Mulberry Club), Минск",
      alt: "Фотография места Малберри Клаб (Mulberry Club), Минск",
      caption: "Фотогалерея места Малберри Клаб (Mulberry Club), Минск",
    },
  });
  assert.equal(d.action, "APPLY");
  if (d.action === "APPLY") {
    // Keep meaningful WP title; only fill missing alt/caption
    assert.equal(d.next.title, "Клуб английского языка Малберри Клаб 02");
    assert.ok(d.next.alt);
    assert.deepEqual(d.changed.sort(), ["alt", "caption"]);
  }
}

{
  const d = decideMigratedMediaMetadataPatch({
    current: {
      title: "Клуб английского языка Малберри Клаб 02",
      alt: "Ручной alt",
      caption: "Ручной caption",
    },
    generated: {
      title: "Generated",
      alt: "Generated alt",
      caption: "Generated caption",
    },
  });
  assert.equal(d.action, "SKIP_UNCHANGED");
}

{
  const d = decideMigratedMediaMetadataPatch({
    current: {
      title: "Иммерсивная выставка &#171;Небо.Река &#8212; Планета после шума&#187; 01",
      alt: "Уже есть",
      caption: null,
    },
    generated: {
      title: "Event — афиша",
      alt: "Афиша",
      caption: "Изображение события",
    },
  });
  assert.equal(d.action, "APPLY");
  if (d.action === "APPLY") {
    assert.ok(d.next.title?.includes("«"));
    assert.equal(d.next.alt, "Уже есть");
    assert.ok(d.changed.includes("title"));
    assert.ok(d.changed.includes("caption"));
    assert.ok(!d.changed.includes("alt"));
  }
}

console.log("decideMigratedMediaMetadataPatch.test.ts: ok");
