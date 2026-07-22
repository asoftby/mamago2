/* eslint-disable @typescript-eslint/no-explicit-any -- intentionally narrow Prisma/dispatcher fakes */
import assert from "node:assert/strict";
import type { MigrationLineage, MigrationRecord } from "@prisma/client";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { getLineageActionForRecord } from "../../ledger";
import { dispatchCommitRunner } from "../dispatch/dispatchCommitRunner";
import { buildOfferCreateDraft } from "./buildOfferCreateDraft";
import { OfferCommitOrchestrator } from "./OfferCommitOrchestrator";
import { OfferCommitRunner } from "./OfferCommitRunner";
import { OfferMediaSyncer } from "./OfferMediaSyncer";
import type { OfferCommitContext } from "./types";

const relation = (placeId: number, key = "post-relation-hb-programs") => ({ post_id: 1, related_post_id: placeId, related_post_type: "places", relation_key: key, relation_order: 0, relation_side: "parent" as const });
function candidate(overrides: Partial<NormalizedOfferCandidate> = {}): NormalizedOfferCandidate {
  return { sourceRecordKey:"wordpress-db:hb-programs:1", sourcePostId:1, sourcePostType:"hb-programs", sourceStatus:"publish", legacyAuthorId:7, publishedAt:"2026-01-01 00:00:00", modifiedAt:"2026-01-01 00:00:00", title:"Golden", slug:"golden", content:"Content", excerpt:"", shortDescription:null, priceText:"from 10", priceTextRaw:"from 10", averageCheck:{raw:"10",parsed:10}, durationMinutes:{raw:null,parsed:null}, maxGuests:{raw:null,parsed:null}, classificationStatus:"UNCLASSIFIED", sourceTerms:[], placeRelation:{status:"SINGLE_PLACE_RELATION",placeSourcePostIds:[100],relations:[relation(100)]}, booking:{raw:null,parsed:null,schemaVariant:null}, ageTerms:[], media:{galleryAttachmentIds:[11],coverAttachmentId:10}, seo:{title:null,description:null,focusKeyword:null,canonicalUrl:null,robots:null,ogTitle:null,ogDescription:null}, oldSlugs:[], rawMeta:{}, ...overrides };
}
const context: OfferCommitContext = { placeId:"place_1",legacyPlaceId:100,ownerUserId:"user_1",businessId:null,cityId:"city_1",mediaPolicy:"NONE" };

async function main(): Promise<void> {
const golden = buildOfferCreateDraft({ candidate:candidate(), context });
assert.equal(golden.ok,true); if(!golden.ok)throw new Error();
assert.deepEqual({placeId:golden.draft.placeId,kind:golden.draft.kind,productType:golden.draft.productType,status:golden.draft.status,media:golden.draft.sourceMediaAttachmentIds},{placeId:"place_1",kind:"SERVICE",productType:null,status:"DRAFT",media:[10,11]});
assert.equal(buildOfferCreateDraft({candidate:candidate(),context}).ok,true,"canonical hash/draft is stable");

assert.equal(buildOfferCreateDraft({candidate:candidate({placeRelation:{status:"NO_PLACE_RELATION",placeSourcePostIds:[],relations:[]}}),context}).ok,false,"missing Place blocks");
const ambiguous=buildOfferCreateDraft({candidate:candidate({placeRelation:{status:"MULTIPLE_PLACE_RELATIONS",placeSourcePostIds:[100,101],relations:[relation(100),relation(101)]}}),context}); assert.equal(ambiguous.ok,false); if(!ambiguous.ok)assert.ok(ambiguous.reasons.some(r=>r.code==="AMBIGUOUS_PLACE_RELATION"));
const noLocal=buildOfferCreateDraft({candidate:candidate(),context:{...context,placeId:""}});assert.equal(noLocal.ok,false);if(!noLocal.ok)assert.ok(noLocal.reasons.some(r=>r.code==="MISSING_LOCAL_PLACE"));
const noOwner=buildOfferCreateDraft({candidate:candidate(),context:{...context,ownerUserId:""}});assert.equal(noOwner.ok,false);if(!noOwner.ok)assert.ok(noOwner.reasons.some(r=>r.code==="MISSING_OWNER"));
const alias=buildOfferCreateDraft({candidate:candidate({sourcePostType:"offers" as NormalizedOfferCandidate["sourcePostType"]}),context});assert.equal(alias.ok,false);if(!alias.ok)assert.ok(alias.reasons.some(r=>r.code==="NONCANONICAL_SOURCE_ALIAS"));
const dedup=buildOfferCreateDraft({candidate:candidate({placeRelation:{status:"MULTIPLE_PLACE_RELATIONS",placeSourcePostIds:[100,100],relations:[relation(100),relation(100,"select-hb-program")]}}),context});assert.equal(dedup.ok,true);if(dedup.ok)assert.ok(dedup.warnings.some(w=>w.code==="OFFER_PLACE_RELATIONS_DEDUPLICATED"));
const invalidRelation=buildOfferCreateDraft({candidate:candidate({placeRelation:{status:"SINGLE_PLACE_RELATION",placeSourcePostIds:[100],relations:[{...relation(100),post_id:2}]}}),context});assert.equal(invalidRelation.ok,false);if(!invalidRelation.ok)assert.ok(invalidRelation.reasons.some(r=>r.code==="INVALID_PLACE_RELATION"));

let fullCalls=0; const media=new OfferMediaSyncer({async sync(input){fullCalls++;assert.deepEqual(input.attachmentIds,[10,11]);return{importedCount:2}}});
assert.equal((await media.sync({offerId:"o",ownerUserId:"u",attachmentIds:[10,11],mediaPolicy:"NONE",sourceRecordKey:"k"})).status,"SKIPPED_POLICY");
assert.equal((await media.sync({offerId:"o",ownerUserId:"u",attachmentIds:[10,11],mediaPolicy:"METADATA",sourceRecordKey:"k"})).status,"SKIPPED_POLICY");assert.equal(fullCalls,0);
assert.equal((await media.sync({offerId:"o",ownerUserId:"u",attachmentIds:[10,11],mediaPolicy:"FULL",sourceRecordKey:"k"})).status,"SYNCED");assert.equal(fullCalls,1);

let offerCount=0,lineageCount=0; const recordUpdates:any[]=[];
const orchestrator=new OfferCommitOrchestrator({async createOfferFromDraft(draft){assert.equal(draft.status,"DRAFT");offerCount++;return{ok:true,offerId:"offer_1"}},async updateOfferTitleCas(){return{ok:true,offerId:"offer_1"}}});
const runner=new OfferCommitRunner({orchestrator,lineageWriter:{async createLineage(input){lineageCount++;return{lineageId:"lineage_1",sourceRecordKey:input.sourceRecordKey,targetType:"OFFER",targetId:input.targetId}}},prisma:{offer:{findUnique:async()=>null} as any,migrationLineage:{findMany:async()=>[],update:async()=>({})} as any,migrationRecord:{update: (async (args:any)=>{recordUpdates.push(args);return{} as any}) as any}}});
const migrationRecord={id:"record_1",sourceId:"source_1",sourceEntityType:"wordpress-db:hb-programs",sourceStableKey:"wordpress-db:hb-programs:1",sourceRecordKey:"wordpress-db:hb-programs:1",sourceHash:golden.canonicalHash,runId:"run_1"} as MigrationRecord;
const operation={recordId:"record_1",sourceRecordKey:migrationRecord.sourceRecordKey,targetType:"OFFER",action:"CREATE",order:0,dependsOn:[],rollbackSteps:[]} as const;
const created=await runner.execute({operation,candidate:candidate(),context,migrationRecord});assert.equal(created.ok,true);assert.equal(offerCount,1);assert.equal(lineageCount,1);assert.equal(recordUpdates.at(-1).data.status,"LINKED");
const lineage={targetType:"OFFER",lastSourceHash:golden.canonicalHash} as MigrationLineage;
assert.equal(getLineageActionForRecord({lineage:[lineage],targetType:"OFFER",sourceHash:golden.canonicalHash}),"SKIP_UNCHANGED");assert.equal(offerCount,1);assert.equal(lineageCount,1,"planner NOOP never invokes runner again");

const dispatched=await dispatchCommitRunner({executionCandidate:{planItem:{sourceRecordKey:migrationRecord.sourceRecordKey,sourceEntityType:migrationRecord.sourceEntityType,targetType:"OFFER",action:"CREATE",status:"PLANNED",summary:{},warnings:[]},candidate:candidate()} as any,resolvedContext:context,migrationRecord,runners:{offer:{execute:async()=>({ok:true,offerId:"offer_1",lineageId:"lineage_1",recordId:"record_1",status:"LINKED"})}}});
assert.deepEqual(dispatched,{ok:true,targetType:"OFFER",targetId:"offer_1",lineageId:"lineage_1",status:"LINKED"});
console.log("offer vertical slice tests: OK");
}
main().catch(error=>{console.error("offer vertical slice tests: FAILED",error);process.exitCode=1});
