import fs from "node:fs";

const resourceFiles = [
  "src/app/api/business/events/[id]/route.ts",
  "src/app/api/business/offers/[id]/route.ts",
  "src/app/api/business/places/[id]/improvement-requests/route.ts",
  "src/app/api/business/places/[id]/location/google/route.ts",
  "src/app/api/business/places/[id]/location/manual/route.ts",
  "src/app/api/business/places/[id]/opening-hours/route.ts",
  "src/app/api/business/places/[id]/revision/images/route.ts",
  "src/app/api/business/places/[id]/revision/opening-hours/route.ts",
  "src/app/api/business/places/[id]/revision/submit/route.ts",
  "src/app/api/business/places/[id]/route.ts",
];

const toolFiles = [
  "src/app/api/business/instagram/avatar/route.ts",
  "src/app/api/business/places/google-preview/route.ts",
  "src/app/api/business/places/location/matches/route.ts",
  "src/app/api/business/places/route.ts",
];

function removeLegacyImport(source) {
  return source.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*["']@\/lib\/auth\/businessContentAccess["'];?\n?/g,
    (full, body) => {
      const names = body
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name) => name !== "canCreateBusinessContent");
      if (names.length === 0) return "";
      if (names.length === 1) {
        return `import { ${names[0]} } from "@/lib/auth/businessContentAccess";\n`;
      }
      return `import {\n  ${names.join(",\n  ")},\n} from "@/lib/auth/businessContentAccess";\n`;
    },
  );
}

function replaceLegacyCondition(source, replacement) {
  const pattern = /!user\s*\|\|\s*!canCreateBusinessContent\(user\.role\)/g;
  const matches = source.match(pattern)?.length ?? 0;
  if (matches === 0) throw new Error("legacy auth condition not found");
  return source.replace(pattern, replacement);
}

function ensureImport(source, statement) {
  if (source.includes(statement)) return source;
  const lines = source.split("\n");
  let index = 0;
  while (
    index < lines.length &&
    (lines[index].startsWith("import ") ||
      lines[index].trim() === "" ||
      lines[index].startsWith("/**") ||
      lines[index].startsWith(" *") ||
      lines[index].startsWith(" */"))
  ) {
    index += 1;
  }
  lines.splice(index, 0, statement);
  return lines.join("\n");
}

for (const path of resourceFiles) {
  let source = fs.readFileSync(path, "utf8");
  const hasResourceGuard =
    source.includes("canManageActivityById") ||
    source.includes("canManagePlaceAsync") ||
    source.includes("requireBusinessPermission") ||
    source.includes("checkUserBusinessPermission");
  if (!hasResourceGuard) {
    throw new Error(`${path}: canonical resource guard not found; refusing automatic edit`);
  }
  source = replaceLegacyCondition(source, "!user");
  source = removeLegacyImport(source);
  fs.writeFileSync(path, source);
  console.log(`resource gate canonicalized: ${path}`);
}

for (const path of toolFiles) {
  let source = fs.readFileSync(path, "utf8");
  source = replaceLegacyCondition(
    source,
    '!user || !(await checkBusinessToolPermission(user, "content.create"))',
  );
  source = removeLegacyImport(source);
  source = ensureImport(
    source,
    'import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";',
  );
  fs.writeFileSync(path, source);
  console.log(`tool gate canonicalized: ${path}`);
}
