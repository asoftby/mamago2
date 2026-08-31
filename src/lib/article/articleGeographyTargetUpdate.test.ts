import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getArticleForEditor, saveArticleDraft } from "./articleAdminService";
import type { ArticleSaveInput } from "./articleAdminTypes";
import { buildArticleEditorCityOptionsWhere } from "./articleEditorOptions";

function input(title: string, additionalGeographyTargets?: ArticleSaveInput["additionalGeographyTargets"]): ArticleSaveInput {
  return {
    title,
    slug: null,
    subtitle: null,
    excerpt: null,
    content: { version: 1, blocks: [] },
    coverImageId: null,
    authorLabel: null,
    authorUserId: null,
    cityContext: null,
    categoryId: null,
    geoScope: "COUNTRY",
    cityId: null,
    regionId: null,
    status: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoRobots: null,
    noindex: false,
    tagIds: [],
    additionalGeographyTargets,
  };
}

async function targetKeys(articleId: string): Promise<string[]> {
  const rows = await prisma.articleGeographyTarget.findMany({
    where: { articleId }, orderBy: { position: "asc" },
    select: { type: true, cityId: true, regionId: true },
  });
  return rows.map((row) => row.type === "CITY" ? `CITY:${row.cityId}` : `REGION:${row.regionId}`);
}

async function main() {
  const marker = randomUUID();
  const country = await prisma.country.findFirst({ where: { isoCode: "BY" }, select: { id: true } });
  const region = await prisma.region.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(country && region, "active country and region fixtures are required");
  const activeCity = await prisma.city.create({
    data: { countryId: country.id, name: `Active ${marker}`, slug: `active-${marker}`, isActive: true },
  });
  const inactiveExistingCity = await prisma.city.create({
    data: { countryId: country.id, name: `Inactive existing ${marker}`, slug: `inactive-existing-${marker}`, isActive: false },
  });
  const inactiveNewCity = await prisma.city.create({
    data: { countryId: country.id, name: `Inactive new ${marker}`, slug: `inactive-new-${marker}`, isActive: false },
  });
  const article = await prisma.article.create({
    data: {
      title: `Target update ${marker}`, geoScope: "COUNTRY", status: "DRAFT",
      additionalGeographyTargets: { create: { type: "CITY", cityId: activeCity.id, position: 0 } },
    },
  });
  try {
    await saveArticleDraft(article.id, input("Omitted writer save"));
    assert.deepEqual(await targetKeys(article.id), [`CITY:${activeCity.id}`], "omitted field preserves targets");

    await saveArticleDraft(article.id, input("Explicit clear", []));
    assert.deepEqual(await targetKeys(article.id), [], "explicit empty array clears targets");

    await saveArticleDraft(article.id, input("Explicit replacement", [{ type: "REGION", regionId: region.id }]));
    assert.deepEqual(await targetKeys(article.id), [`REGION:${region.id}`], "values replace targets authoritatively");

    await saveArticleDraft(article.id, input("Breaking-news style omitted save"));
    assert.deepEqual(await targetKeys(article.id), [`REGION:${region.id}`], "specialized writer omission preserves targets");

    await prisma.articleGeographyTarget.deleteMany({ where: { articleId: article.id } });
    await prisma.articleGeographyTarget.create({
      data: { articleId: article.id, type: "CITY", cityId: inactiveExistingCity.id, position: 0 },
    });
    const snapshot = await getArticleForEditor(article.id);
    assert.deepEqual(snapshot?.additionalGeographyTargets, [{ type: "CITY", cityId: inactiveExistingCity.id }]);
    const defaultOptions = await prisma.city.findMany({ where: buildArticleEditorCityOptionsWhere([]), select: { id: true } });
    assert.ok(defaultOptions.some((city) => city.id === activeCity.id), "active city is selectable");
    assert.ok(!defaultOptions.some((city) => city.id === inactiveNewCity.id), "unassigned inactive city is hidden");
    const selectedOptions = await prisma.city.findMany({
      where: buildArticleEditorCityOptionsWhere([inactiveExistingCity.id]), select: { id: true },
    });
    assert.ok(selectedOptions.some((city) => city.id === inactiveExistingCity.id), "selected inactive city remains displayable");
    await saveArticleDraft(article.id, input("Unrelated save preserves inactive target"));
    assert.deepEqual(await targetKeys(article.id), [`CITY:${inactiveExistingCity.id}`]);

    await assert.rejects(
      saveArticleDraft(article.id, input("Must roll back", [{ type: "CITY", cityId: inactiveNewCity.id }])),
      /действительные дополнительные города/,
    );
    const afterFailure = await prisma.article.findUniqueOrThrow({ where: { id: article.id }, select: { title: true } });
    assert.equal(afterFailure.title, "Unrelated save preserves inactive target", "failed explicit update rolls back Article fields");
    assert.deepEqual(await targetKeys(article.id), [`CITY:${inactiveExistingCity.id}`], "failed explicit update preserves targets");
  } finally {
    await prisma.article.delete({ where: { id: article.id } });
    await prisma.city.deleteMany({ where: { id: { in: [activeCity.id, inactiveExistingCity.id, inactiveNewCity.id] } } });
  }
  console.log("articleGeographyTargetUpdate.test.ts: OK");
}

void main();
