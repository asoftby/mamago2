export type LogicalIdentityKind =
  | "technicalMigrationCreator"
  | "userSourceRecordKey"
  | "userEmail"
  | "businessSourceKey"
  | "citySlug"
  | "placeSourceRecordKey"
  | "offerSourceRecordKey"
  | "articleAuthorSourceRecordKey";

export interface LogicalIdentity {
  kind: LogicalIdentityKind;
  value: string;
}

export interface LogicalIdentityLookup {
  find(identity: LogicalIdentity): Promise<readonly { id: string }[]>;
}

export async function resolveLogicalIdentity(
  lookup: LogicalIdentityLookup,
  identity: LogicalIdentity,
): Promise<string> {
  const matches = await lookup.find(identity);
  if (matches.length !== 1) {
    throw new Error(
      `LOGICAL_IDENTITY_${matches.length === 0 ? "NOT_FOUND" : "AMBIGUOUS"}: ${identity.kind}:${identity.value} matched ${matches.length}.`,
    );
  }
  return matches[0].id;
}
