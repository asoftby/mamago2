#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { normalizeOffer, type NormalizedOfferCandidate } from "../src/lib/migration/adapters/wordpress-db/normalizeOffer";
import { loadOfferSnapshotEnvelope } from "../src/lib/migration/adapters/wordpress-db/loadOfferSnapshotEnvelope";
import { buildOfferCreateDraft } from "../src/lib/migration/commit/offer/buildOfferCreateDraft";

function arg(name: string): string | null { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] ?? null : null }
const sourceRecordKey = arg("--source-record-key");
if (!sourceRecordKey) throw new Error("--source-record-key is required");
const root = arg("--snapshot-root") ?? "/tmp/scratchpad/offers";
const envelope=loadOfferSnapshotEnvelope({snapshotRoot:root,sourceRecordKey});
const normalized=normalizeOffer(envelope.rawPayload as import("../src/lib/migration/adapters/wordpress-db/types").WordPressOfferBundle); const candidate=normalized.normalizedPayload as NormalizedOfferCandidate;
interface InventoryRow { sourceRecordKey:string; classification:string; selectedLocalPlace:{id:string}; legacyRelatedPlaceIds:number[]; ownerMapping:{userId:string}; businessLocalMatch:{id?:string}; cityLocalMatch:{id:string} }
const parsedInventory = JSON.parse(readFileSync(`${root}/analysis/offers-inventory.json`,"utf8")) as {records:InventoryRow[]};
const inventory=parsedInventory.records.find(row=>row.sourceRecordKey===sourceRecordKey);
if(!inventory||!["A","C"].includes(inventory.classification))throw new Error(`Source key is not approved class A/C (class=${inventory?.classification??"missing"}).`);
const built=buildOfferCreateDraft({candidate,context:{placeId:inventory.selectedLocalPlace.id,legacyPlaceId:inventory.legacyRelatedPlaceIds[0],ownerUserId:inventory.ownerMapping.userId,businessId:inventory.businessLocalMatch.id??null,cityId:inventory.cityLocalMatch.id,mediaPolicy:"NONE"}});
if(!built.ok)throw new Error(built.reasons.map(reason=>reason.code).join(","));
console.log(JSON.stringify({mode:"preview",sourceRecordKey,action:"CREATE",canonicalHash:built.canonicalHash,targetMappings:{placeId:built.draft.placeId,ownerUserId:built.draft.ownership.ownerUserId,businessId:built.draft.ownership.businessId,cityId:built.draft.ownership.cityId},warnings:[...(normalized.warnings??[]),...built.warnings],draft:built.draft,expectedDeltas:{Offer:1,MigrationLineage:1,MigrationRecord:"one existing planned record transitions to LINKED",media:0,forbiddenTables:0}},null,2));
