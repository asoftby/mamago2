const WORDPRESS_ATTACHMENT_SOURCE_RECORD_KEY_PREFIX = "wordpress-db:attachment:";

/**
 * The single, shared `sourceRecordKey` format for a WordPress attachment.
 * PR13 (`MediaImportWriter`) and PR14 (`PlaceMediaLinker`) must agree on
 * this exact string or lineage lookups silently miss — so both consume
 * this one function instead of each hand-rolling their own template.
 */
export function buildWordPressAttachmentSourceRecordKey(attachmentId: number | string): string {
  return `${WORDPRESS_ATTACHMENT_SOURCE_RECORD_KEY_PREFIX}${attachmentId}`;
}
