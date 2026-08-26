import assert from "node:assert/strict";
import {
  countMediaTitleActions,
  decideMediaTitleOwnership,
  mediaEntityTypeBadgeLabel,
  resolveAdminMediaListTitle,
  shouldAutoReplaceMediaTitle,
} from "./mediaTitleOwnership";

{
  assert.equal(shouldAutoReplaceMediaTitle({ currentTitle: "Media" }), true);
  assert.equal(shouldAutoReplaceMediaTitle({ currentTitle: "IMG_8536" }), true);
  assert.equal(
    shouldAutoReplaceMediaTitle({
      currentTitle: "IMG_8536",
      originalName: "img_8536-scaled.jpg",
    }),
    true,
  );
  assert.equal(
    shouldAutoReplaceMediaTitle({
      currentTitle: "Клуб английского языка Малберри Клаб 02",
      originalName: "01-79cy.webp",
    }),
    false,
  );
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m1",
    currentTitle: "photo_2024-08-08_18-39-28 (2)",
    originalName: "photo_2024-08-08_18-39-28-2-1.webp",
    filename: "tvorcheskie-kruzhki-01.webp",
    owners: [{ entityType: "ARTICLE", entityId: "a1", entityTitle: "Творческие кружки в Минске" }],
  });
  assert.equal(d.action, "update-title-article");
  assert.equal(d.proposedTitle, "Творческие кружки в Минске");
  assert.equal(d.currentTitle, "photo_2024-08-08_18-39-28 (2)");
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m2",
    currentTitle: "Клуб английского языка Малберри Клаб 02",
    originalName: "01-79cy.webp",
    filename: "malberri-klab-logo.webp",
    owners: [{ entityType: "PLACE", entityId: "p1", entityTitle: "Малберри Клаб (Mulberry Club)" }],
  });
  assert.equal(d.action, "skip-manual-title");
  assert.equal(d.proposedTitle, "Клуб английского языка Малберри Клаб 02");
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m3",
    currentTitle: "Media",
    originalName: "media.webp",
    filename: "master-klass-ebru-01.webp",
    owners: [
      { entityType: "EVENT", entityId: "e1", entityTitle: "Мастер-класс Эбру" },
      { entityType: "ARTICLE", entityId: "a9", entityTitle: "Другая статья" },
    ],
  });
  assert.equal(d.action, "skip-shared-title");
  assert.equal(d.usageCount, 2);
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m4",
    currentTitle: "Малберри Клаб (Mulberry Club)",
    owners: [{ entityType: "PLACE", entityId: "p1", entityTitle: "Малберри Клаб (Mulberry Club)" }],
  });
  assert.equal(d.action, "already-correct");
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m5",
    currentTitle: "avatar.png",
    owners: [{ entityType: "USER", entityId: "u1", entityTitle: "user@example.com" }],
  });
  assert.equal(d.action, "skip-user");
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m6",
    currentTitle: "logo",
    branding: true,
    owners: [],
  });
  assert.equal(d.action, "skip-branding");
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m7",
    currentTitle: "orphan.jpg",
    owners: [],
  });
  assert.equal(d.action, "skip-orphan");
}

{
  // Multiple usages of the SAME entity count as one owner
  const d = decideMediaTitleOwnership({
    mediaId: "m8",
    currentTitle: "IMG_0912",
    originalName: "img_0912-scaled.jpg",
    filename: "marshrut-01.webp",
    owners: [
      { entityType: "ROUTE", entityId: "r1", entityTitle: "Маршрут по Питеру" },
      { entityType: "ROUTE", entityId: "r1", entityTitle: "Маршрут по Питеру" },
    ],
  });
  assert.equal(d.action, "update-title-route");
  assert.equal(d.usageCount, 1);
  assert.equal(d.proposedTitle, "Маршрут по Питеру");
}

{
  const d = decideMediaTitleOwnership({
    mediaId: "m9",
    currentTitle: "dsc_0675.jpg",
    originalName: "dsc_0675-scaled.jpg",
    filename: "den-rozhdeniya-01.webp",
    owners: [{ entityType: "OFFER", entityId: "o1", entityTitle: "День Рождения на скаладроме" }],
  });
  assert.equal(d.action, "update-title-offer");
}

{
  assert.equal(
    resolveAdminMediaListTitle({
      title: "Media",
      filename: "slug-01.webp",
    }),
    "Media",
  );
  assert.equal(
    resolveAdminMediaListTitle({
      title: null,
      entityTitle: "Статья",
      filename: "slug-01.webp",
    }),
    "Статья",
  );
  assert.equal(
    resolveAdminMediaListTitle({
      title: "  ",
      entityTitle: null,
      filename: "slug-01.webp",
    }),
    "slug-01.webp",
  );
  assert.equal(mediaEntityTypeBadgeLabel("ARTICLE"), "Статья");
  assert.equal(mediaEntityTypeBadgeLabel("PLACE"), "Место");
}

{
  const counts = countMediaTitleActions([
    { action: "update-title-article" },
    { action: "update-title-article" },
    { action: "skip-manual-title" },
    { action: "already-correct" },
  ]);
  assert.equal(counts["update-title-article"], 2);
  assert.equal(counts["skip-manual-title"], 1);
  assert.equal(counts["already-correct"], 1);
  assert.equal(counts["update-title-place"], 0);
}

console.log("mediaTitleOwnership.test.ts: ok");
