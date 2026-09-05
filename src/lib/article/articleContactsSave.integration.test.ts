import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { ArticleAdminPutBodySchema, articleSaveInputFromPutBody } from "./articleAdminPutBody";
import { createArticleFromSaveInput, getArticleForEditor, saveArticleDraft } from "./articleAdminService";
import { newBlock, prepareArticleContentForSave, type ArticleBlockMvp } from "../publications/articleMvp";

const allBlockTypes = ["intro", "text", "quote", "heading", "image", "gallery", "activityCard", "embed", "contacts", "price", "openingHours"] as const;

function body(content: { version: 1; blocks: ArticleBlockMvp[] }, title: string) {
  return ArticleAdminPutBodySchema.parse({
    title,
    slug: null,
    content: prepareArticleContentForSave(content),
    coverImageId: null,
    geoScope: "COUNTRY",
    cityId: null,
    regionId: null,
    status: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    noindex: false,
  });
}

async function main() {
  let articleId: string | null = null;
  try {
    const initialBlocks = allBlockTypes.map((type) => newBlock(type, () => `all-${type}-${randomUUID()}`));
    const initialContent = {
      version: 1 as const,
      blocks: initialBlocks.map((block) => block.type === "contacts"
        ? { ...block, data: { address: " Минск ", phones: [{ value: " +375291112233 ", label: " Справочная " }], socials: [{ kind: "telegram" as const, url: " https://t.me/mamago " }] } }
        : block.type === "price"
          ? { ...block, data: { ...block.data, mode: "EXACT" as const, min: 20, max: 20, items: [{ id: "adult", label: " Взрослый ", price: " 20 ", unit: " BYN " }] } }
          : block),
    };
    const created = await createArticleFromSaveInput(articleSaveInputFromPutBody(body(initialContent, "All blocks save regression")));
    articleId = created.id;
    assert.equal(created.content.blocks.length, allBlockTypes.length);
    assert.deepEqual(created.content.blocks.map((block) => block.type), allBlockTypes, "block order survives create/reload");
    const createdContacts = created.content.blocks.find((block) => block.type === "contacts");
    assert.ok(createdContacts?.type === "contacts");
    assert.deepEqual(createdContacts.data.phones, [{ value: "+375291112233", label: "Справочная" }]);
    assert.deepEqual(createdContacts.data.socials, [{ kind: "telegram", url: "https://t.me/mamago" }]);

    const withBlankContactRows = {
      ...created.content,
      blocks: created.content.blocks.map((block) => block.type === "contacts"
        ? { ...block, data: { ...block.data, phones: [{ value: "" }], socials: [{ kind: "instagram" as const, url: "" }] } }
        : block),
    };
    await saveArticleDraft(created.id, articleSaveInputFromPutBody(body(withBlankContactRows, "Blank contact drafts save regression")));
    const reloaded = await getArticleForEditor(created.id);
    assert.ok(reloaded);
    const contacts = reloaded.content.blocks.find((block) => block.type === "contacts");
    assert.ok(contacts?.type === "contacts");
    assert.deepEqual(contacts.data.phones, []);
    assert.deepEqual(contacts.data.socials, []);
    assert.equal(reloaded.content.blocks.length, allBlockTypes.length, "all blocks survive persistence roundtrip");
    console.log(`articleContactsSave.integration.test.ts: OK article=${created.id}`);
  } finally {
    if (articleId) await prisma.article.delete({ where: { id: articleId } });
    await prisma.$disconnect();
  }
}

void main();
