import { readFileSync } from "node:fs";
import { hashOfferBundle } from "./canonicalSourceHash";
import type { WordPressOfferBundle, WordPressOfferPlaceRelationRow, WordPressPostRow, WordPressTermRow } from "./types";
import type { SourceRecordEnvelope } from "../../types";

const decode = (value: string) => Buffer.from(value || "", "hex").toString("utf8");

export function loadOfferSnapshotEnvelope(input: { snapshotRoot: string; sourceRecordKey: string }): SourceRecordEnvelope {
  const match = /^wordpress-db:(hb-programs|services):([1-9]\d*)$/.exec(input.sourceRecordKey);
  if (!match) throw new Error("Only canonical hb-programs/services Offer source keys are allowed.");
  const id = Number(match[2]);
  const lines = readFileSync(`${input.snapshotRoot}/source-capture-final.tsv`, "utf8").split("\n");
  const postLine = lines.find(line => line.startsWith(`POST\t${id}\t`));
  if (!postLine) throw new Error(`Post ${id} is absent from snapshot.`);
  const p = postLine.split("\t");
  if (p[2] !== match[1] || p[3] !== "publish") throw new Error("Snapshot post does not match the canonical published key.");
  const post: WordPressPostRow = { ID:id, post_type:p[2], post_status:p[3], post_title:decode(p[4]), post_name:decode(p[5]), post_content:decode(p[6]), post_excerpt:decode(p[7]), post_date:decode(p[8]), post_modified:decode(p[9]), post_author:Number(p[10]), post_parent:Number(p[11]), guid:decode(p[13]), post_mime_type:"" };
  const postMeta: Record<string,string[]> = {}; const terms: WordPressTermRow[] = [];
  for (const line of lines) { const f=line.split("\t"); if(Number(f[1])!==id) continue; if(f[0]==="META") (postMeta[decode(f[2])]??=[]).push(decode(f[3])); if(f[0]==="TERM") terms.push({post_id:id,taxonomy:decode(f[2]),term_id:Number(f[3]),slug:decode(f[5]),name:decode(f[6])}) }
  const placeRelations: WordPressOfferPlaceRelationRow[] = [];
  for(const line of readFileSync(`${input.snapshotRoot}/raw/wp_voxel_relations.tsv`,"utf8").trim().split("\n")){const f=line.split("\t"),side=f[5] as "parent"|"child",offerId=side==="parent"?Number(f[2]):Number(f[1]);if(offerId===id)placeRelations.push({post_id:id,related_post_id:Number(f[6]),related_post_type:decode(f[7]),relation_key:decode(f[3]),relation_order:Number(f[4]),relation_side:side})}
  const bundle: WordPressOfferBundle = { post, postMeta, terms, placeRelations };
  return { sourceEntityType:`wordpress-db:${post.post_type}`,sourceStableKey:input.sourceRecordKey,sourceRecordKey:input.sourceRecordKey,sourceUpdatedAt:post.post_modified,sourceHash:hashOfferBundle(bundle),rawPayload:bundle };
}
