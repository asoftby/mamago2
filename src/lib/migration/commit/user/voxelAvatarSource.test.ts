import assert from "node:assert/strict";

import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import { classifyVoxelAvatarSource, VOXEL_AVATAR_META_KEY } from "./voxelAvatarSource";

assert.equal(VOXEL_AVATAR_META_KEY, "voxel:avatar");

const attachment: WordPressAttachmentRow = {
  ID: 555,
  post_title: "avatar",
  post_name: "avatar",
  post_mime_type: "image/jpeg",
  guid: "https://mamago.by/?attachment_id=555",
  post_parent: 0,
  attached_file: "2024/01/avatar.jpg",
};

const attachmentsById = new Map([[555, attachment]]);

// No usermeta row at all -> leave avatarUrl unchanged.
assert.deepEqual(
  classifyVoxelAvatarSource({ rawMetaValue: undefined, attachmentsById }),
  { status: "NO_AVATAR_SOURCE" },
);
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: null, attachmentsById }), { status: "NO_AVATAR_SOURCE" });
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "", attachmentsById }), { status: "NO_AVATAR_SOURCE" });
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "   ", attachmentsById }), { status: "NO_AVATAR_SOURCE" });

// Valid numeric attachment id with a matching wp_posts row.
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById }), {
  status: "AVATAR_ATTACHMENT_VALID",
  attachmentId: 555,
  attachment,
});
// Whitespace-padded id is still valid (WordPress meta values sometimes are).
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: " 555 ", attachmentsById }), {
  status: "AVATAR_ATTACHMENT_VALID",
  attachmentId: 555,
  attachment,
});

// Numeric id but no matching wp_posts attachment row -> broken ref.
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "999", attachmentsById }), {
  status: "AVATAR_ATTACHMENT_MISSING",
  attachmentId: 999,
});

// Telegram t.me URL (wptg_login_avatar-shaped value, defensively rejected even under this key).
assert.deepEqual(
  classifyVoxelAvatarSource({ rawMetaValue: "https://t.me/i/userpic/320/example.jpg", attachmentsById }),
  { status: "AVATAR_NON_ATTACHMENT_VALUE", rawValue: "https://t.me/i/userpic/320/example.jpg" },
);

// Gravatar-shaped value.
assert.deepEqual(
  classifyVoxelAvatarSource({ rawMetaValue: "https://www.gravatar.com/avatar/abc123", attachmentsById }),
  { status: "AVATAR_NON_ATTACHMENT_VALUE", rawValue: "https://www.gravatar.com/avatar/abc123" },
);

// Mystery/default avatar sentinel.
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "mystery-man", attachmentsById }), {
  status: "AVATAR_NON_ATTACHMENT_VALUE",
  rawValue: "mystery-man",
});

// Zero / negative are not valid WordPress attachment ids.
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "0", attachmentsById }), {
  status: "AVATAR_NON_ATTACHMENT_VALUE",
  rawValue: "0",
});
assert.deepEqual(classifyVoxelAvatarSource({ rawMetaValue: "-5", attachmentsById }), {
  status: "AVATAR_NON_ATTACHMENT_VALUE",
  rawValue: "-5",
});

console.log("voxelAvatarSource tests: OK");
